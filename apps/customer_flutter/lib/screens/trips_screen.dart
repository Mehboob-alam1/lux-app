import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/booking_api.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../utils/booking_ui.dart';
import '../widgets/lux_chrome.dart';

class TripsScreen extends StatelessWidget {
  const TripsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: StreamBuilder(
          stream: BookingApi.instance.watchMyBookings(),
          builder: (context, snap) {
            if (snap.hasError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(LuxSpacing.screenH),
                  child: Text(
                    BookingApi.instance.mapError(snap.error!),
                    style: const TextStyle(color: LuxColors.danger),
                  ),
                ),
              );
            }
            final rows = snap.data;
            if (rows == null) {
              return const Center(child: CircularProgressIndicator());
            }

            final active = rows
                .where((r) => BookingUi.isActive(r['currentStatus'] as String?))
                .toList();
            final past = rows
                .where((r) => !BookingUi.isActive(r['currentStatus'] as String?))
                .toList();

            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 100),
              children: [
                Text('Trips', style: LuxTypography.display(context)),
                const SizedBox(height: 8),
                Text(
                  rows.isEmpty
                      ? 'Your confirmed bookings appear here'
                      : '${active.length} active · ${past.length} past',
                  style: LuxTypography.bodyMuted,
                ),
                const SizedBox(height: LuxSpacing.lg),
                if (rows.isEmpty)
                  LuxEmptyState(
                    title: 'No trips yet',
                    body: 'Book a transfer to see status and fare here.',
                    icon: Icons.route_outlined,
                    action: LuxPrimaryButton(
                      label: 'Book a transfer',
                      onPressed: () => context.push('/book'),
                    ),
                  )
                else ...[
                  if (active.isNotEmpty) ...[
                    const LuxSectionLabel('Active'),
                    const SizedBox(height: 10),
                    ...active.map(_TripCard.new),
                    const SizedBox(height: LuxSpacing.md),
                  ],
                  if (past.isNotEmpty) ...[
                    const LuxSectionLabel('Past'),
                    const SizedBox(height: 10),
                    ...past.map(_TripCard.new),
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

class _TripCard extends StatelessWidget {
  const _TripCard(this.booking);
  final Map<String, dynamic> booking;

  @override
  Widget build(BuildContext context) {
    final id = booking['bookingId'] as String? ?? '—';
    final status = booking['currentStatus'] as String? ?? '—';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: LuxCard(
        onTap: () => context.push('/trips/$id'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    id,
                    style: LuxTypography.caption.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                LuxStatusPill(
                  label: BookingUi.label(status),
                  color: BookingUi.color(status),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              BookingUi.routeSummary(booking),
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 16,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              [
                booking['classId']?.toString() ?? '—',
                BookingUi.fare(booking),
                if (BookingUi.scheduleLabel(booking) != null)
                  BookingUi.scheduleLabel(booking)!,
              ].join(' · '),
              style: LuxTypography.caption,
            ),
          ],
        ),
      ),
    );
  }
}
