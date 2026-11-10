import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../maps/geo_math.dart';
import '../maps/lux_route_preview.dart';
import '../services/booking_api.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../utils/booking_ui.dart';
import '../widgets/lux_chrome.dart';

class TripDetailScreen extends StatelessWidget {
  const TripDetailScreen({super.key, required this.bookingId});
  final String bookingId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: Column(
          children: [
            LuxScreenHeader(
              title: 'Trip detail',
              subtitle: bookingId,
              onBack: () =>
                  context.canPop() ? context.pop() : context.go('/trips'),
            ),
            Expanded(
              child: StreamBuilder<Map<String, dynamic>?>(
                stream: BookingApi.instance.watchBooking(bookingId),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting &&
                      !snap.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final b = snap.data;
                  if (b == null) {
                    return const LuxEmptyState(
                      title: 'Booking not found',
                      body: 'It may have been removed or the id is wrong.',
                    );
                  }
                  final status = b['currentStatus'] as String? ?? '—';
                  final pickup = BookingUi.placeLabel(b, 'PICKUP');
                  final dropoff = BookingUi.placeLabel(b, 'DROPOFF');

                  return ListView(
                    padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
                    children: [
                      LuxCard(
                        color: BookingUi.color(status).withValues(alpha: 0.12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            LuxStatusPill(
                              label: BookingUi.label(status),
                              color: BookingUi.color(status),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              BookingUi.fare(b),
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 28,
                              ),
                            ),
                            if (BookingUi.scheduleLabel(b) != null) ...[
                              const SizedBox(height: 6),
                              Text(
                                BookingUi.scheduleLabel(b)!,
                                style: LuxTypography.bodyMuted,
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: LuxSpacing.md),
                      const LuxSectionLabel('Route'),
                      const SizedBox(height: 8),
                      Builder(
                        builder: (context) {
                          final p = _coords(b, 'PICKUP');
                          final d = _coords(b, 'DROPOFF');
                          if (p == null || d == null) {
                            return LuxCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _stop('Pickup', pickup ?? '—'),
                                  const Divider(height: 24),
                                  _stop('Dropoff', dropoff ?? '—'),
                                ],
                              ),
                            );
                          }
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              LuxRoutePreview(
                                pickup: p,
                                dropoff: d,
                                pickupLabel: pickup,
                                dropoffLabel: dropoff,
                              ),
                              const SizedBox(height: 10),
                              LuxCard(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _stop('Pickup', pickup ?? '—'),
                                    const Divider(height: 24),
                                    _stop('Dropoff', dropoff ?? '—'),
                                  ],
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: LuxSpacing.md),
                      const LuxSectionLabel('Details'),
                      const SizedBox(height: 8),
                      LuxCard(
                        child: Column(
                          children: [
                            _kv('Class', b['classId']?.toString() ?? '—'),
                            _kv('Market', b['marketId']?.toString() ?? '—'),
                            _kv(
                              'Payment',
                              b['paymentStatus']?.toString() ?? '—',
                            ),
                            _kv(
                              'Driver',
                              b['assignedDriverId']?.toString() ?? 'Unassigned',
                            ),
                            _kv('Risk', b['riskState']?.toString() ?? '—'),
                          ],
                        ),
                      ),
                      const SizedBox(height: LuxSpacing.lg),
                      if (b['assignedDriverId'] != null) ...[
                        LuxPrimaryButton(
                          label: 'Chat with driver',
                          onPressed: () =>
                              context.push('/trips/$bookingId/chat'),
                        ),
                        const SizedBox(height: 10),
                      ],
                      OutlinedButton(
                        onPressed: () => context.go('/support'),
                        child: const Text('Chat with ops support'),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
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

  Widget _stop(String kind, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(kind, style: LuxTypography.caption),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
        ],
      );

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(
              child: Text(k, style: const TextStyle(color: LuxColors.muted)),
            ),
            Flexible(
              child: Text(
                v,
                textAlign: TextAlign.end,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      );
}
