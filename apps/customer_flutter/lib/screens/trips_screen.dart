import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/booking_api.dart';
import '../theme/lux_colors.dart';
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
              return Center(child: Text('Trips error: ${snap.error}'));
            }
            final rows = snap.data ?? const <Map<String, dynamic>>[];
            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 100),
              children: [
                const Text('Trips',
                    style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900, letterSpacing: -0.8)),
                const SizedBox(height: 8),
                Text('${rows.length} bookings from Firestore',
                    style: const TextStyle(color: LuxColors.muted)),
                const SizedBox(height: 20),
                if (rows.isEmpty)
                  const LuxCard(
                    child: Text('No bookings yet. Create one from Book.',
                        style: TextStyle(color: LuxColors.muted)),
                  )
                else
                  ...rows.map((b) {
                    final id = b['bookingId'] as String? ?? '—';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: LuxCard(
                        onTap: () => context.push('/trips/$id'),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(id,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        color: LuxColors.muted,
                                        fontSize: 12)),
                                const Spacer(),
                                Text(b['currentStatus']?.toString() ?? '—',
                                    style: const TextStyle(fontWeight: FontWeight.w900)),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '${b['classId'] ?? '—'} · \$${(((b['customerPriceMinor'] as num?)?.toInt() ?? 0) / 100).toStringAsFixed(2)} ${b['currency'] ?? 'CAD'}',
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
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
