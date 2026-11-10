import 'package:flutter/material.dart';

import '../services/driver_api.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../widgets/lux_chrome.dart';

class EarningsScreen extends StatelessWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: StreamBuilder(
          stream: DriverApi.instance.watchAssignedBookings(),
          builder: (context, snap) {
            final rows = snap.data ?? const <Map<String, dynamic>>[];
            final completed =
                rows.where((r) => r['currentStatus'] == 'COMPLETED').toList();
            final total = completed.fold<int>(
              0,
              (sum, r) =>
                  sum + ((r['driverPayoutMinor'] as num?)?.toInt() ?? 0),
            );
            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              children: [
                Text('Earnings', style: LuxTypography.display(context)),
                const SizedBox(height: 8),
                const Text(
                  'Totals from completed assigned bookings (driverPayoutMinor).',
                  style: LuxTypography.bodyMuted,
                ),
                const SizedBox(height: LuxSpacing.lg),
                LuxCard(
                  color: LuxColors.lime.withValues(alpha: 0.55),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Completed payouts',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '\$${(total / 100).toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 40,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        '${completed.length} completed trip${completed.length == 1 ? '' : 's'}',
                        style: LuxTypography.caption,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: LuxSpacing.lg),
                const LuxSectionLabel('Completed trips'),
                const SizedBox(height: 10),
                if (completed.isEmpty)
                  const LuxEmptyState(
                    title: 'No completed trips yet',
                    body: 'Finish an active trip to see payout rows here.',
                    icon: Icons.payments_outlined,
                  )
                else
                  ...completed.map((b) {
                    final payout =
                        ((b['driverPayoutMinor'] as num?)?.toInt() ?? 0) / 100;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: LuxCard(
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                b['bookingId']?.toString() ?? '—',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            Text(
                              '\$${payout.toStringAsFixed(2)}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            );
          },
        ),
      ),
    );
  }
}
