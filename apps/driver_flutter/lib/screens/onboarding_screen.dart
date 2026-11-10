import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/app_prefs.dart';
import '../services/auth_service.dart';
import '../services/firebase_bootstrap.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../widgets/lux_chrome.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  bool _busy = false;

  Future<void> _continueSignedIn() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await AuthService.instance.ensureProvisioned();
      await AppPrefs.setWelcomeSeen();
      if (!mounted) return;
      context.go('/my-day');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AuthService.instance.mapError(e))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final signedIn = user != null;

    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(LuxSpacing.screenH),
          children: [
            const SizedBox(height: 24),
            Container(
              width: 72,
              height: 72,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: LuxColors.lime,
                shape: BoxShape.circle,
              ),
              child: const Text(
                'L',
                style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(height: 20),
            Text('LUX Driver', style: LuxTypography.display(context)),
            const SizedBox(height: 10),
            Text(
              FirebaseBootstrap.ready
                  ? (signedIn
                      ? 'Complete the checklist below before going online.'
                      : 'Sign in or create a chauffeur account to take offers.')
                  : 'Firebase not ready — check your connection.',
              style: LuxTypography.bodyMuted,
            ),
            if (FirebaseBootstrap.initError != null) ...[
              const SizedBox(height: 12),
              Text(
                FirebaseBootstrap.initError!,
                style: const TextStyle(color: LuxColors.danger),
              ),
            ],
            if (signedIn) ...[
              const SizedBox(height: LuxSpacing.lg),
              const LuxSectionLabel('Eligibility checklist'),
              const SizedBox(height: 8),
              _EligibilityChecklist(uid: user.uid),
            ] else ...[
              const SizedBox(height: LuxSpacing.lg),
              LuxCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'What you need',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    SizedBox(height: 8),
                    Text('· Valid chauffeur licence'),
                    Text('· Approved vehicle & insurance'),
                    Text('· Ops review before first ONLINE'),
                  ],
                ),
              ),
            ],
            const SizedBox(height: LuxSpacing.xl),
            LuxPrimaryButton(
              label: signedIn ? 'Continue to My Day' : 'Sign in',
              loading: _busy,
              onPressed: () {
                if (signedIn) {
                  _continueSignedIn();
                } else {
                  context.go('/auth');
                }
              },
            ),
            if (!signedIn) ...[
              const SizedBox(height: 12),
              LuxSecondaryButton(
                label: 'Create driver account',
                onPressed: () => context.go('/auth/signup'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EligibilityChecklist extends StatelessWidget {
  const _EligibilityChecklist({required this.uid});
  final String uid;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance
          .collection('drivers')
          .doc(uid)
          .snapshots(),
      builder: (context, driverSnap) {
        final driver = driverSnap.data?.data();
        final provisioned = driver != null;
        final status = driver?['status'] as String? ?? 'MISSING';
        final online = driver?['onlineState'] as String? ?? 'OFFLINE';
        final vehicleId = driver?['currentVehicleId'] as String?;

        Widget body(List<_CheckItem> items) {
          return LuxCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final item in items)
                  ListTile(
                    leading: Icon(
                      item.ok ? Icons.check_circle : Icons.radio_button_unchecked,
                      color: item.ok
                          ? const Color(0xFF2F7D32)
                          : LuxColors.muted,
                    ),
                    title: Text(item.label),
                    subtitle: item.detail == null
                        ? null
                        : Text(
                            item.detail!,
                            style: const TextStyle(color: LuxColors.muted),
                          ),
                    trailing: item.actionLabel == null
                        ? null
                        : TextButton(
                            onPressed: item.onAction,
                            child: Text(item.actionLabel!),
                          ),
                  ),
              ],
            ),
          );
        }

        if (!provisioned) {
          return body([
            const _CheckItem(
              label: 'Driver profile provisioned',
              ok: false,
              detail: 'Sign-in will create your driver record',
            ),
            const _CheckItem(label: 'Vehicle approved', ok: false),
            const _CheckItem(label: 'Documents eligible', ok: false),
            const _CheckItem(label: 'Status ACTIVE', ok: false),
          ]);
        }

        if (vehicleId == null) {
          return body([
            const _CheckItem(label: 'Driver profile provisioned', ok: true),
            _CheckItem(
              label: 'Vehicle linked',
              ok: false,
              detail: 'No currentVehicleId',
              actionLabel: 'Docs',
              onAction: () => context.push('/vehicle-docs'),
            ),
            _CheckItem(
              label: 'Status $status',
              ok: status == 'ACTIVE',
            ),
            _CheckItem(
              label: 'Online state $online',
              ok: true,
              detail: 'Toggle online from My Day when eligible',
            ),
          ]);
        }

        return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance
              .collection('vehicles')
              .doc(vehicleId)
              .snapshots(),
          builder: (context, vehSnap) {
            final veh = vehSnap.data?.data();
            final vehStatus = veh?['status'] as String? ?? 'UNKNOWN';
            final docsOk = veh?['documentEligibilityOk'] == true;
            final approved = vehStatus == 'APPROVED';
            final active = status == 'ACTIVE';

            return body([
              const _CheckItem(
                label: 'Driver profile provisioned',
                ok: true,
              ),
              _CheckItem(
                label: 'Vehicle $vehStatus',
                ok: approved,
                detail: veh == null
                    ? 'Vehicle record missing'
                    : '${veh['make'] ?? ''} ${veh['model'] ?? ''} · ${veh['plate'] ?? ''}'
                        .trim(),
                actionLabel: 'Review',
                onAction: () => context.push('/vehicle-docs'),
              ),
              _CheckItem(
                label: 'Documents eligible',
                ok: docsOk,
                detail: docsOk
                    ? 'Licence / insurance / inspection OK'
                    : 'Blocked until ops marks documents eligible',
                actionLabel: 'Docs',
                onAction: () => context.push('/vehicle-docs'),
              ),
              _CheckItem(
                label: 'Driver status $status',
                ok: active,
                    detail: active
                        ? 'Ready to go online'
                        : (driver['statusReason'] as String? ??
                            'Awaiting ops approval'),
              ),
              _CheckItem(
                label: 'Can accept offers',
                ok: active && approved && docsOk,
                detail: active && approved && docsOk
                    ? 'Eligibility gates satisfied'
                    : 'Need ACTIVE + approved vehicle + eligible docs',
              ),
            ]);
          },
        );
      },
    );
  }
}

class _CheckItem {
  const _CheckItem({
    required this.label,
    required this.ok,
    this.detail,
    this.actionLabel,
    this.onAction,
  });
  final String label;
  final bool ok;
  final String? detail;
  final String? actionLabel;
  final VoidCallback? onAction;
}
