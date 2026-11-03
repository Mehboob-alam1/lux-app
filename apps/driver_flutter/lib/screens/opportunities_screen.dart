import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/driver_api.dart';
import '../theme/lux_colors.dart';

class OpportunitiesScreen extends StatelessWidget {
  const OpportunitiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: StreamBuilder(
          stream: DriverApi.instance.offersStream(),
          builder: (context, snap) {
            if (snap.hasError) {
              return Center(child: Text('${snap.error}'));
            }
            final docs = snap.data?.docs ?? [];
            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              children: [
                const Text('Offers',
                    style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900)),
                const SizedBox(height: 8),
                Text('${docs.length} PENDING driver_offers',
                    style: const TextStyle(color: LuxColors.muted)),
                const SizedBox(height: 16),
                if (docs.isEmpty)
                  const Text('No offers yet. Confirm a customer booking while online.',
                      style: TextStyle(color: LuxColors.muted))
                else
                  ...docs.map((d) {
                    final data = d.data();
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: LuxColors.surface,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: LuxColors.line),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(d.id, style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text('booking ${data['bookingId']}',
                              style: const TextStyle(color: LuxColors.muted)),
                          const SizedBox(height: 10),
                          FilledButton(
                            onPressed: () async {
                              try {
                                final vehicle =
                                    await DriverApi.instance.myVehicle();
                                if (vehicle == null) {
                                  throw StateError('No seeded vehicle for driver');
                                }
                                final res = await DriverApi.instance.acceptOffer(
                                  offerId: d.id,
                                  vehicleId: vehicle['vehicleId'] as String,
                                );
                                final bookingId = res['bookingId'] as String? ??
                                    data['bookingId'] as String?;
                                if (context.mounted && bookingId != null) {
                                  context.push('/active-trip/$bookingId');
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('$e')),
                                  );
                                }
                              }
                            },
                            style: FilledButton.styleFrom(
                              backgroundColor: LuxColors.lime,
                              foregroundColor: LuxColors.ink,
                            ),
                            child: const Text('Accept offer',
                                style: TextStyle(fontWeight: FontWeight.w900)),
                          ),
                        ],
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
