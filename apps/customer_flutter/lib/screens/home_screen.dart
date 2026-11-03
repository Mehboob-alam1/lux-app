import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/booking_api.dart';
import '../services/firebase_bootstrap.dart';
import '../theme/lux_colors.dart';
import '../widgets/lux_chrome.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 100),
          children: [
            Text(
              user?.email ?? 'Customer',
              style: const TextStyle(color: LuxColors.muted, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            const Text(
              'Book a transfer',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -0.7),
            ),
            const SizedBox(height: 8),
            Text(
              FirebaseBootstrap.usingEmulators
                  ? 'Quotes & bookings via Cloud Functions (emulator)'
                  : 'Quotes & bookings via Cloud Functions',
              style: const TextStyle(color: LuxColors.muted),
            ),
            const SizedBox(height: 24),
            LuxCard(
              onTap: () => context.push('/book'),
              child: const Row(
                children: [
                  Icon(Icons.local_taxi_outlined, size: 28),
                  SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('New booking', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                        Text('createQuote → authorizePayment → confirmBooking',
                            style: TextStyle(color: LuxColors.muted, fontSize: 12)),
                      ],
                    ),
                  ),
                  Icon(Icons.arrow_forward_rounded),
                ],
              ),
            ),
            const SizedBox(height: 16),
            StreamBuilder(
              stream: BookingApi.instance.watchMyBookings(),
              builder: (context, snap) {
                final rows = snap.data ?? const <Map<String, dynamic>>[];
                final active = rows.where((r) {
                  final s = r['currentStatus'] as String? ?? '';
                  return s != 'COMPLETED' && s != 'CANCELLED' && s != 'NO_SHOW';
                }).toList();
                if (active.isEmpty) {
                  return const LuxCard(
                    child: Text('No active bookings yet.', style: TextStyle(color: LuxColors.muted)),
                  );
                }
                final b = active.first;
                final id = b['bookingId'] as String? ?? '—';
                return LuxCard(
                  onTap: () => context.push('/trips/$id'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(b['currentStatus']?.toString() ?? '—',
                          style: const TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 6),
                      Text(id, style: const TextStyle(color: LuxColors.muted)),
                      const SizedBox(height: 6),
                      Text(
                        '${b['classId'] ?? '—'} · ${((b['customerPriceMinor'] as num?)?.toInt() ?? 0) / 100} ${b['currency'] ?? 'CAD'}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
