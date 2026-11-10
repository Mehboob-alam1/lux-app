import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/driver_api.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../utils/trip_guide.dart';
import '../widgets/lux_chrome.dart';

class DriverTripsScreen extends StatelessWidget {
  const DriverTripsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: StreamBuilder(
          stream: DriverApi.instance.watchAssignedBookings(),
          builder: (context, snap) {
            if (snap.hasError) {
              return Center(
                child: Text(
                  DriverApi.instance.mapError(snap.error!),
                  style: const TextStyle(color: LuxColors.danger),
                ),
              );
            }
            final rows = snap.data ?? const <Map<String, dynamic>>[];
            final open = rows
                .where((r) => TripGuide.isOpen(r['currentStatus'] as String?))
                .toList();
            final past = rows
                .where((r) => !TripGuide.isOpen(r['currentStatus'] as String?))
                .toList();

            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              children: [
                Text('Trips', style: LuxTypography.display(context)),
                const SizedBox(height: 8),
                Text(
                  rows.isEmpty
                      ? 'Assigned bookings appear after you accept an offer'
                      : '${open.length} open · ${past.length} past',
                  style: LuxTypography.bodyMuted,
                ),
                const SizedBox(height: LuxSpacing.lg),
                if (rows.isEmpty)
                  const LuxEmptyState(
                    title: 'No assigned trips',
                    body: 'Accept a pending offer to start a trip.',
                    icon: Icons.route_outlined,
                  )
                else ...[
                  if (open.isNotEmpty) ...[
                    const LuxSectionLabel('Open'),
                    const SizedBox(height: 10),
                    ...open.map(_TripTile.new),
                    const SizedBox(height: LuxSpacing.md),
                  ],
                  if (past.isNotEmpty) ...[
                    const LuxSectionLabel('Past'),
                    const SizedBox(height: 10),
                    ...past.map(_TripTile.new),
                  ],
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TripTile extends StatelessWidget {
  const _TripTile(this.booking);
  final Map<String, dynamic> booking;

  @override
  Widget build(BuildContext context) {
    final id = booking['bookingId'] as String? ?? '—';
    final status = booking['currentStatus'] as String? ?? '—';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: LuxCard(
        onTap: () => context.push('/active-trip/$id'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(id, style: LuxTypography.caption),
                ),
                LuxStatusPill(
                  label: TripGuide.label(status),
                  color: TripGuide.color(status),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${TripGuide.placeLabel(booking, 'PICKUP') ?? 'Pickup'} → ${TripGuide.placeLabel(booking, 'DROPOFF') ?? 'Dropoff'}',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}
