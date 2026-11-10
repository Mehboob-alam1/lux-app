import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/driver_api.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../widgets/lux_chrome.dart';
import '../widgets/lux_feedback.dart';

class OpportunitiesScreen extends StatefulWidget {
  const OpportunitiesScreen({super.key});

  @override
  State<OpportunitiesScreen> createState() => _OpportunitiesScreenState();
}

class _OpportunitiesScreenState extends State<OpportunitiesScreen> {
  String? _acceptingId;

  Future<void> _accept(String offerId, Map<String, dynamic> data) async {
    if (_acceptingId != null) return;
    setState(() => _acceptingId = offerId);
    try {
      final vehicle = await DriverApi.instance.myVehicle();
      if (vehicle == null) {
        throw StateError('No vehicle linked. Complete onboarding first.');
      }
      final res = await DriverApi.instance.acceptOffer(
        offerId: offerId,
        vehicleId: vehicle['vehicleId'] as String,
      );
      final bookingId =
          res['bookingId'] as String? ?? data['bookingId'] as String?;
      if (!mounted) return;
      LuxFeedback.success(context, 'Offer accepted');
      if (bookingId != null) {
        context.push('/active-trip/$bookingId');
      }
    } catch (e) {
      if (!mounted) return;
      LuxFeedback.error(context, e, fallback: DriverApi.instance.mapError(e));
    } finally {
      if (mounted) setState(() => _acceptingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: StreamBuilder(
          stream: DriverApi.instance.offersStream(),
          builder: (context, snap) {
            if (snap.hasError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(LuxSpacing.screenH),
                  child: Text(
                    DriverApi.instance.mapError(snap.error!),
                    style: const TextStyle(color: LuxColors.danger),
                  ),
                ),
              );
            }
            final docs = snap.data?.docs ?? [];
            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              children: [
                Text('Offers', style: LuxTypography.display(context)),
                const SizedBox(height: 8),
                Text(
                  docs.isEmpty
                      ? 'Pending offers appear when you are ONLINE and eligible'
                      : '${docs.length} pending offer${docs.length == 1 ? '' : 's'}',
                  style: LuxTypography.bodyMuted,
                ),
                const SizedBox(height: LuxSpacing.lg),
                if (docs.isEmpty)
                  const LuxEmptyState(
                    title: 'No offers yet',
                    body:
                        'Confirm a customer booking while you are online to receive dispatch offers.',
                    icon: Icons.inbox_outlined,
                  )
                else
                  ...docs.map((d) {
                    final data = d.data();
                    final bookingId = data['bookingId']?.toString() ?? '—';
                    final expires = data['expiresAt']?.toString();
                    final accepting = _acceptingId == d.id;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: LuxCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const LuxStatusPill(
                                  label: 'Pending',
                                  color: LuxColors.statusPending,
                                ),
                                const Spacer(),
                                Text(
                                  d.id,
                                  style: LuxTypography.caption,
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Booking $bookingId',
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 17,
                              ),
                            ),
                            if (expires != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                'Expires $expires',
                                style: LuxTypography.caption,
                              ),
                            ],
                            const SizedBox(height: 14),
                            LuxPrimaryButton(
                              label: 'Accept offer',
                              loading: accepting,
                              enabled: _acceptingId == null,
                              onPressed: () => _accept(d.id, data),
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
