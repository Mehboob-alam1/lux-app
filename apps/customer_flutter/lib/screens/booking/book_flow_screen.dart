import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../data/booking_draft.dart';
import '../../data/lux_catalog.dart';
import '../../data/models.dart';
import '../../services/booking_api.dart';
import '../../theme/lux_colors.dart';
import '../../widgets/lux_chrome.dart';

class BookFlowScreen extends ConsumerStatefulWidget {
  const BookFlowScreen({super.key});

  @override
  ConsumerState<BookFlowScreen> createState() => _BookFlowScreenState();
}

class _BookFlowScreenState extends ConsumerState<BookFlowScreen> {
  int step = 0;
  bool busy = false;
  String? notice;
  String? quoteId;
  int? quoteMinor;
  String currency = 'CAD';

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
      setState(() => notice = 'Choose pickup and dropoff');
      return;
    }
    if (step < 3) {
      setState(() {
        step++;
        notice = null;
      });
      if (step == 3) await _loadQuote();
      return;
    }
    await _confirm();
  }

  Future<void> _loadQuote() async {
    final draft = ref.read(bookingDraftProvider);
    setState(() {
      busy = true;
      notice = 'Requesting quote from Cloud Functions…';
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
        notice = q.notice;
      });
    } catch (e) {
      setState(() => notice = 'Quote failed: $e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _confirm() async {
    if (quoteId == null) {
      await _loadQuote();
      if (quoteId == null) return;
    }
    setState(() {
      busy = true;
      notice = 'Authorizing payment + confirming booking…';
    });
    try {
      final result = await BookingApi.instance.authorizeAndConfirm(
        quoteId: quoteId!,
      );
      final bookingId = result['bookingId'] as String? ??
          (result['booking'] as Map?)?['bookingId'] as String?;
      if (!mounted) return;
      context.go('/book/confirmed?bookingId=${bookingId ?? 'pending'}');
    } catch (e) {
      setState(() => notice = 'Booking failed: $e');
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
                    child: Container(
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
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                children: [
                  if (step == 0) ..._route(draft),
                  if (step == 1) ..._when(draft),
                  if (step == 2) ..._vehicle(draft),
                  if (step == 3) ..._review(draft),
                  if (notice != null) ...[
                    const SizedBox(height: 12),
                    Text(notice!, style: const TextStyle(color: LuxColors.muted)),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
              child: LuxPrimaryButton(
                label: busy
                    ? 'Working…'
                    : step == 3
                        ? 'Pay & confirm'
                        : 'Continue',
                enabled: !busy,
                onPressed: _next,
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _route(BookingDraftController draft) => [
        const LuxSectionLabel('Pickup'),
        const SizedBox(height: 10),
        ...LuxCatalog.pickupSuggestions.map(
          (p) => _place(p, draft.pickup?.label == p.label, () => draft.setPickup(p)),
        ),
        const SizedBox(height: 16),
        const LuxSectionLabel('Dropoff'),
        const SizedBox(height: 10),
        ...LuxCatalog.dropoffSuggestions.map(
          (p) => _place(p, draft.dropoff?.label == p.label, () => draft.setDropoff(p)),
        ),
      ];

  Widget _place(Place p, bool selected, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: LuxCard(
        onTap: onTap,
        child: Row(
          children: [
            Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.label, style: const TextStyle(fontWeight: FontWeight.w800)),
                  Text(p.address, style: const TextStyle(color: LuxColors.muted, fontSize: 13)),
                ],
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
      LuxCard(
        onTap: () => _pickDateTime(draft),
        child: Row(
          children: [
            const Icon(Icons.schedule_rounded),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                fmt.format(draft.scheduledAt),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      LuxCard(
        child: Column(
          children: [
            TextField(
              decoration: const InputDecoration(
                labelText: 'Flight number (optional)',
                border: InputBorder.none,
              ),
              onChanged: (v) => draft.setFlight(v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Meet & greet'),
              value: draft.meetAndGreet,
              activeThumbColor: LuxColors.ink,
              activeTrackColor: LuxColors.lime,
              onChanged: (v) => draft.setFlight(draft.flightNumber, meet: v),
            ),
            Row(
              children: [
                const Expanded(child: Text('Passengers', style: TextStyle(fontWeight: FontWeight.w700))),
                IconButton(
                  onPressed: () => draft.setPassengers(draft.passengers - 1),
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text('${draft.passengers}', style: const TextStyle(fontWeight: FontWeight.w900)),
                IconButton(
                  onPressed: () => draft.setPassengers(draft.passengers + 1),
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
            Row(
              children: [
                const Expanded(child: Text('Luggage', style: TextStyle(fontWeight: FontWeight.w700))),
                IconButton(
                  onPressed: () => draft.setLuggage(draft.luggage - 1),
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text('${draft.luggage}', style: const TextStyle(fontWeight: FontWeight.w900)),
                IconButton(
                  onPressed: () => draft.setLuggage(draft.luggage + 1),
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
          ],
        ),
      ),
    ];
  }

  List<Widget> _vehicle(BookingDraftController draft) => LuxCatalog.classes
      .map(
        (vc) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: LuxCard(
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
                      Text(vc.name, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                      Text(vc.tagline, style: const TextStyle(color: LuxColors.muted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      )
      .toList();

  List<Widget> _review(BookingDraftController draft) {
    final fmt = DateFormat('EEE, MMM d · h:mm a');
    return [
      LuxCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(fmt.format(draft.scheduledAt), style: const TextStyle(color: LuxColors.muted)),
            const SizedBox(height: 10),
            Text(draft.pickup?.label ?? '—', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20)),
            Text('→  ${draft.dropoff?.label ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
            const SizedBox(height: 10),
            Text(
              '${LuxCatalog.classById(draft.vehicleClassId).name} · ${draft.passengers} pax',
              style: const TextStyle(color: LuxColors.muted),
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      LuxCard(
        child: Row(
          children: [
            const Expanded(child: Text('Server quote', style: TextStyle(fontWeight: FontWeight.w700))),
            Text(
              quoteMinor == null
                  ? '…'
                  : '\$${(quoteMinor! / 100).toStringAsFixed(2)} $currency',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22),
            ),
          ],
        ),
      ),
    ];
  }
}
