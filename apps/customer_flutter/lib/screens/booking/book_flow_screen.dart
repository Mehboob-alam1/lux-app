import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/booking_draft.dart';
import '../../data/lux_catalog.dart';
import '../../maps/geo_math.dart';
import '../../maps/lux_route_preview.dart';
import '../../maps/route_location_picker.dart';
import '../../services/booking_api.dart';
import '../../theme/lux_colors.dart';
import '../../theme/lux_spacing.dart';
import '../../theme/lux_typography.dart';
import '../../widgets/lux_chrome.dart';
import '../../widgets/lux_feedback.dart';
import '../../widgets/lux_text_field.dart';

class BookFlowScreen extends ConsumerStatefulWidget {
  const BookFlowScreen({super.key});

  @override
  ConsumerState<BookFlowScreen> createState() => _BookFlowScreenState();
}

class _BookFlowScreenState extends ConsumerState<BookFlowScreen> {
  int step = 0;
  bool busy = false;
  String? quoteId;
  int? quoteMinor;
  String currency = 'CAD';
  String? quoteNotice;
  final _flight = TextEditingController();

  @override
  void dispose() {
    _flight.dispose();
    super.dispose();
  }

  Future<void> _pickDateTime(BookingDraftController draft) async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 120)),
      initialDate: draft.scheduledAt,
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(draft.scheduledAt),
    );
    if (time == null) return;
    draft.setSchedule(
      DateTime(date.year, date.month, date.day, time.hour, time.minute),
    );
  }

  Future<void> _next() async {
    final draft = ref.read(bookingDraftProvider);
    if (step == 0 && !draft.canSubmit) {
      LuxFeedback.warning(context, 'Choose pickup and dropoff to continue.');
      return;
    }
    if (step < 3) {
      setState(() => step++);
      if (step == 3) await _loadQuote();
      return;
    }
    await _confirm();
  }

  Future<void> _loadQuote() async {
    final draft = ref.read(bookingDraftProvider);
    setState(() {
      busy = true;
      quoteId = null;
      quoteMinor = null;
      quoteNotice = null;
    });
    try {
      final isAirport = draft.dropoff!.label.contains('YYZ') ||
          draft.dropoff!.label.contains('YTZ') ||
          draft.flightNumber != null;
      final q = await BookingApi.instance.createQuote(
        passengers: draft.passengers,
        luggage: draft.luggage,
        classId: draft.vehicleClassId,
        pickup: LuxCatalog.placePayload(draft.pickup!),
        dropoff: LuxCatalog.placePayload(draft.dropoff!),
        tripContext: isAirport ? 'AIRPORT' : 'STANDARD',
        scheduledAt: draft.scheduledAt,
        addons: [
          if (draft.meetAndGreet) 'MEET_AND_GREET',
        ],
        airport: isAirport
            ? {
                'airportId': 'YYZ',
                if (draft.flightNumber != null)
                  'flightNumber': draft.flightNumber,
                'meetAndGreet': draft.meetAndGreet,
              }
            : null,
      );
      setState(() {
        quoteId = q.quoteId;
        quoteMinor = q.totalMinor;
        currency = q.currency;
        quoteNotice = q.notice;
      });
    } catch (e) {
      if (!mounted) return;
      LuxFeedback.error(
        context,
        e,
        fallback: BookingApi.instance.mapError(e),
      );
      setState(() => step = 2);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _confirm() async {
    if (quoteId == null) {
      await _loadQuote();
      if (quoteId == null) return;
    }
    setState(() => busy = true);
    try {
      final result = await BookingApi.instance.authorizeAndConfirm(
        quoteId: quoteId!,
      );
      final bookingId = result['bookingId'] as String? ??
          (result['booking'] as Map?)?['bookingId'] as String?;
      if (!mounted) return;
      LuxFeedback.success(context, 'Booking confirmed');
      context.go('/book/confirmed?bookingId=${bookingId ?? 'pending'}');
    } catch (e) {
      if (!mounted) return;
      LuxFeedback.error(
        context,
        e,
        fallback: BookingApi.instance.mapError(e),
      );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(bookingDraftProvider);
    final titles = ['Route', 'When', 'Vehicle', 'Review'];

    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: Column(
          children: [
            LuxScreenHeader(
              title: 'Book · ${titles[step]}',
              subtitle: 'Step ${step + 1} of 4',
              onBack: () {
                if (step == 0) {
                  context.pop();
                } else {
                  setState(() => step--);
                }
              },
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
              child: Row(
                children: List.generate(4, (i) {
                  final on = i <= step;
                  return Expanded(
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      height: 4,
                      margin: EdgeInsets.only(right: i == 3 ? 0 : 6),
                      decoration: BoxDecoration(
                        color: on ? LuxColors.ink : LuxColors.line,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                  );
                }),
              ),
            ),
            Expanded(
              child: step == 0
                  ? RouteLocationPicker(
                      pickup: draft.pickup,
                      dropoff: draft.dropoff,
                      onPickupChanged: draft.setPickup,
                      onDropoffChanged: draft.setDropoff,
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                      children: [
                        if (step == 1) ..._when(draft),
                        if (step == 2) ..._vehicle(draft),
                        if (step == 3) ..._review(draft),
                      ],
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
              child: LuxPrimaryButton(
                label: step == 0
                    ? (draft.canSubmit
                        ? 'Continue'
                        : 'Set pickup & dropoff')
                    : step == 3
                        ? 'Pay & confirm'
                        : 'Continue',
                loading: busy,
                enabled: step != 0 || draft.canSubmit,
                onPressed: _next,
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _when(BookingDraftController draft) {
    final fmt = DateFormat('EEE, MMM d · h:mm a');
    return [
      Text('Schedule', style: LuxTypography.sectionTitle),
      const SizedBox(height: 6),
      const Text(
        'Pickup time, passengers, and optional flight details.',
        style: LuxTypography.bodyMuted,
      ),
      const SizedBox(height: LuxSpacing.md),
      LuxCard(
        onTap: () => _pickDateTime(draft),
        child: Row(
          children: [
            const Icon(Icons.schedule_rounded),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                fmt.format(draft.scheduledAt),
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 17,
                ),
              ),
            ),
            const Icon(Icons.edit_calendar_outlined, size: 20),
          ],
        ),
      ),
      const SizedBox(height: LuxSpacing.md),
      LuxTextField(
        controller: _flight,
        label: 'Flight number (optional)',
        hint: 'e.g. AC123',
        prefixIcon: Icons.flight_outlined,
        textCapitalization: TextCapitalization.characters,
        onChanged: (v) => draft.setFlight(v),
      ),
      const SizedBox(height: LuxSpacing.sm),
      LuxCard(
        child: Column(
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Meet & greet'),
              subtitle: const Text('Chauffeur meets you at arrivals'),
              value: draft.meetAndGreet,
              activeThumbColor: LuxColors.ink,
              activeTrackColor: LuxColors.lime,
              onChanged: (v) => draft.setFlight(draft.flightNumber, meet: v),
            ),
            const Divider(height: 1),
            _counter(
              'Passengers',
              draft.passengers,
              () => draft.setPassengers(draft.passengers - 1),
              () => draft.setPassengers(draft.passengers + 1),
            ),
            _counter(
              'Luggage',
              draft.luggage,
              () => draft.setLuggage(draft.luggage - 1),
              () => draft.setLuggage(draft.luggage + 1),
            ),
          ],
        ),
      ),
    ];
  }

  Widget _counter(
    String label,
    int value,
    VoidCallback dec,
    VoidCallback inc,
  ) {
    return Row(
      children: [
        Expanded(
          child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
        IconButton(
          onPressed: dec,
          icon: const Icon(Icons.remove_circle_outline),
        ),
        Text('$value', style: const TextStyle(fontWeight: FontWeight.w900)),
        IconButton(
          onPressed: inc,
          icon: const Icon(Icons.add_circle_outline),
        ),
      ],
    );
  }

  List<Widget> _vehicle(BookingDraftController draft) => [
        Text('Choose class', style: LuxTypography.sectionTitle),
        const SizedBox(height: 6),
        const Text(
          'Capacity is enforced by the quote server.',
          style: LuxTypography.bodyMuted,
        ),
        const SizedBox(height: LuxSpacing.md),
        ...LuxCatalog.classes.map(
          (vc) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: LuxCard(
              selected: draft.vehicleClassId == vc.id,
              onTap: () => draft.setClass(vc.id),
              child: Row(
                children: [
                  Icon(
                    draft.vehicleClassId == vc.id
                        ? Icons.check_circle
                        : Icons.circle_outlined,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          vc.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                          ),
                        ),
                        Text(vc.tagline, style: LuxTypography.caption),
                        const SizedBox(height: 4),
                        Text(
                          'Up to ${vc.passengers} pax · ${vc.luggage} bags',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ];

  List<Widget> _review(BookingDraftController draft) {
    final fmt = DateFormat('EEE, MMM d · h:mm a');
    return [
      Text('Review & pay', style: LuxTypography.sectionTitle),
      const SizedBox(height: 6),
      const Text(
        'Price comes from createQuote. Confirm runs authorizePayment then confirmBooking.',
        style: LuxTypography.bodyMuted,
      ),
      const SizedBox(height: LuxSpacing.md),
      if (draft.pickup != null && draft.dropoff != null) ...[
        LuxRoutePreview(
          pickup: LatLng(draft.pickup!.lat, draft.pickup!.lng),
          dropoff: LatLng(draft.dropoff!.lat, draft.dropoff!.lng),
          pickupLabel: draft.pickup!.label,
          dropoffLabel: draft.dropoff!.label,
          height: 150,
        ),
        const SizedBox(height: LuxSpacing.md),
      ],
      LuxCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              fmt.format(draft.scheduledAt),
              style: LuxTypography.caption,
            ),
            const SizedBox(height: 10),
            Text(
              draft.pickup?.label ?? '—',
              style: const TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 20,
              ),
            ),
            Text(
              '→  ${draft.dropoff?.label ?? '—'}',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 17,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '${LuxCatalog.classById(draft.vehicleClassId).name} · ${draft.passengers} pax · ${draft.luggage} bags',
              style: LuxTypography.bodyMuted,
            ),
            if (draft.meetAndGreet) ...[
              const SizedBox(height: 4),
              const Text(
                'Meet & greet included',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
          ],
        ),
      ),
      const SizedBox(height: 12),
      LuxCard(
        color: LuxColors.lime.withValues(alpha: 0.35),
        child: Row(
          children: [
            const Expanded(
              child: Text(
                'Server quote',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            if (busy && quoteMinor == null)
              const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4),
              )
            else
              Text(
                quoteMinor == null
                    ? '—'
                    : '\$${(quoteMinor! / 100).toStringAsFixed(2)} $currency',
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 22,
                ),
              ),
          ],
        ),
      ),
      if (quoteNotice != null) ...[
        const SizedBox(height: 10),
        Text(quoteNotice!, style: LuxTypography.caption),
      ],
      if (quoteId != null) ...[
        const SizedBox(height: 6),
        Text('Quote $quoteId', style: LuxTypography.caption),
      ],
      const SizedBox(height: 8),
      TextButton(
        onPressed: busy ? null : _loadQuote,
        child: const Text('Refresh quote'),
      ),
    ];
  }
}
