import 'package:flutter/material.dart';
import '../services/driver_api.dart';
import '../theme/lux_colors.dart';

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
              (sum, r) => sum + ((r['driverPayoutMinor'] as num?)?.toInt() ?? 0),
            );
            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              children: [
                const Text('Earnings',
                    style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900)),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: LuxColors.lime,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Completed payouts', style: TextStyle(fontWeight: FontWeight.w700)),
                      Text('\$${(total / 100).toStringAsFixed(2)}',
                          style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w900)),
                      Text('${completed.length} completed trips'),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
