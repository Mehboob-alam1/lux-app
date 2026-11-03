import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/booking_api.dart';
import '../theme/lux_colors.dart';
import '../widgets/lux_chrome.dart';

class TripDetailScreen extends StatelessWidget {
  const TripDetailScreen({super.key, required this.bookingId});
  final String bookingId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: FutureBuilder(
          future: BookingApi.instance.getBooking(bookingId),
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            final b = snap.data;
            return Column(
              children: [
                LuxScreenHeader(
                  title: bookingId,
                  onBack: () =>
                      context.canPop() ? context.pop() : context.go('/trips'),
                ),
                Expanded(
                  child: b == null
                      ? const Center(child: Text('Booking not found'))
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                          children: [
                            LuxCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(b['currentStatus']?.toString() ?? '—',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w900,
                                          fontSize: 22)),
                                  const SizedBox(height: 12),
                                  _kv('Market', b['marketId']?.toString() ?? '—'),
                                  _kv('Class', b['classId']?.toString() ?? '—'),
                                  _kv(
                                    'Fare',
                                    '\$${(((b['customerPriceMinor'] as num?)?.toInt() ?? 0) / 100).toStringAsFixed(2)} ${b['currency'] ?? 'CAD'}',
                                  ),
                                  _kv('Payment', b['paymentStatus']?.toString() ?? '—'),
                                  _kv('Driver', b['assignedDriverId']?.toString() ?? 'Unassigned'),
                                  _kv('Risk', b['riskState']?.toString() ?? '—'),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            LuxPrimaryButton(
                              label: 'Open support',
                              onPressed: () => context.go('/support'),
                            ),
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

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(child: Text(k, style: const TextStyle(color: LuxColors.muted))),
            Text(v, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      );
}
