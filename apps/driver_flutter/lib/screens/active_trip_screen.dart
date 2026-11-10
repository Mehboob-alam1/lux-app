import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../maps/geo_math.dart';
import '../maps/lux_route_preview.dart';
import '../services/driver_api.dart';
import '../services/location_service.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../utils/trip_guide.dart';
import '../widgets/lux_chrome.dart';
import '../widgets/lux_feedback.dart';

class ActiveTripScreen extends StatefulWidget {
  const ActiveTripScreen({super.key, required this.bookingId});
  final String bookingId;

  @override
  State<ActiveTripScreen> createState() => _ActiveTripScreenState();
}

class _ActiveTripScreenState extends State<ActiveTripScreen> {
  bool _busy = false;
  DriverFix? _lastFix;

  Future<Map<String, double>> _pingLocation() async {
    final fix = await LocationService.current();
    if (mounted) setState(() => _lastFix = fix);
    try {
      await DriverApi.instance.updateLocation(
        lat: fix.lat,
        lng: fix.lng,
        bookingId: widget.bookingId,
      );
    } catch (_) {}
    return {'lat': fix.lat, 'lng': fix.lng};
  }

  Future<void> _run(String action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final location = await _pingLocation();
      await DriverApi.instance.tripAction(
        bookingId: widget.bookingId,
        action: action,
        location: location,
      );
      if (!mounted) return;
      LuxFeedback.success(context, TripGuide.label(action));
      if (action == 'COMPLETE' || action == 'PASSENGER_NO_SHOW') {
        context.go('/earnings');
      }
    } catch (e) {
      if (!mounted) return;
      LuxFeedback.error(context, e, fallback: DriverApi.instance.mapError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(Map<String, dynamic> booking) async {
    final assignmentId = booking['assignmentId'] as String? ??
        booking['currentAssignmentId'] as String?;
    if (assignmentId == null) {
      LuxFeedback.error(
        context,
        'No assignment id on booking — cannot cancel.',
      );
      return;
    }
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await DriverApi.instance.cancelAssignment(
        bookingId: widget.bookingId,
        assignmentId: assignmentId,
        reason: 'Driver cancelled from app',
      );
      if (!mounted) return;
      LuxFeedback.success(context, 'Assignment cancelled');
      context.go('/my-day');
    } catch (e) {
      if (!mounted) return;
      LuxFeedback.error(context, e, fallback: DriverApi.instance.mapError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  LatLng? _coords(Map<String, dynamic> b, String kind) {
    final itin = b['itinerary'];
    if (itin is! List) return null;
    for (final raw in itin) {
      if (raw is! Map) continue;
      if (raw['kind']?.toString() != kind) continue;
      final place = raw['place'];
      if (place is! Map) continue;
      final loc = place['location'];
      if (loc is Map) {
        final lat = (loc['lat'] as num?)?.toDouble();
        final lng = (loc['lng'] as num?)?.toDouble();
        if (lat != null && lng != null) return LatLng(lat, lng);
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: StreamBuilder<Map<String, dynamic>?>(
          stream: DriverApi.instance.watchBooking(widget.bookingId),
          builder: (context, snap) {
            final booking = snap.data;
            final status = booking?['currentStatus'] as String? ?? '—';
            final actions = TripGuide.actionsFor(status);
            final primary = actions.where((a) => a.primary).toList();
            final secondary = actions.where((a) => !a.primary).toList();
            final pickup = booking == null ? null : _coords(booking, 'PICKUP');
            final dropoff = booking == null ? null : _coords(booking, 'DROPOFF');

            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
              children: [
                LuxScreenHeader(
                  title: 'Active trip',
                  subtitle: widget.bookingId,
                  onBack: () => context.go('/my-day'),
                ),
                if (booking == null)
                  const Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else ...[
                  if (pickup != null && dropoff != null) ...[
                    LuxRoutePreview(
                      pickup: pickup,
                      dropoff: dropoff,
                      pickupLabel: TripGuide.placeLabel(booking, 'PICKUP'),
                      dropoffLabel: TripGuide.placeLabel(booking, 'DROPOFF'),
                      height: 160,
                    ),
                    const SizedBox(height: LuxSpacing.md),
                  ],
                  LuxCard(
                    color: TripGuide.color(status).withValues(alpha: 0.12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        LuxStatusPill(
                          label: TripGuide.label(status),
                          color: TripGuide.color(status),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          TripGuide.placeLabel(booking, 'PICKUP') ?? 'Pickup',
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 20,
                          ),
                        ),
                        Text(
                          '→ ${TripGuide.placeLabel(booking, 'DROPOFF') ?? 'Dropoff'}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${booking['classId'] ?? '—'} · ${booking['paymentStatus'] ?? '—'}',
                          style: LuxTypography.caption,
                        ),
                        if (_lastFix != null) ...[
                          const SizedBox(height: 6),
                          Text(
                            'Last ping · ${_lastFix!.label}',
                            style: LuxTypography.caption,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: LuxSpacing.md),
                  LuxPrimaryButton(
                    label: 'Chat with customer',
                    onPressed: () =>
                        context.push('/active-trip/${widget.bookingId}/chat'),
                  ),
                  const SizedBox(height: LuxSpacing.lg),
                  const LuxSectionLabel('Next step'),
                  const SizedBox(height: 10),
                  if (actions.isEmpty)
                    LuxCard(
                      child: Text(
                        TripGuide.isOpen(status)
                            ? 'No driver actions for this status.'
                            : 'This trip is finished.',
                        style: LuxTypography.bodyMuted,
                      ),
                    )
                  else ...[
                    ...primary.map(
                      (a) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: LuxPrimaryButton(
                          label: a.label,
                          loading: _busy,
                          onPressed: () => _run(a.action),
                        ),
                      ),
                    ),
                    if (secondary.isNotEmpty) ...[
                      const SizedBox(height: LuxSpacing.sm),
                      const LuxSectionLabel('Also available'),
                      const SizedBox(height: 10),
                      ...secondary.map(
                        (a) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: a.destructive
                              ? OutlinedButton(
                                  onPressed:
                                      _busy ? null : () => _run(a.action),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: LuxColors.danger,
                                    minimumSize: const Size.fromHeight(52),
                                    side: const BorderSide(
                                      color: LuxColors.danger,
                                    ),
                                  ),
                                  child: Text(a.label),
                                )
                              : LuxSecondaryButton(
                                  label: a.label,
                                  enabled: !_busy,
                                  onPressed: () => _run(a.action),
                                ),
                        ),
                      ),
                    ],
                  ],
                  const SizedBox(height: LuxSpacing.lg),
                  TextButton(
                    onPressed: _busy ? null : () => _cancel(booking),
                    child: const Text(
                      'Cancel assignment (reassign)',
                      style: TextStyle(color: LuxColors.danger),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Each step pings GPS (or demo fallback) then calls tripLifecycle. Invalid jumps are rejected by the booking state machine.',
                    style: LuxTypography.caption,
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
