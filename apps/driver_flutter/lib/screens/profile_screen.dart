import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/auth_service.dart';
import '../services/firebase_bootstrap.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../widgets/lux_chrome.dart';
import '../widgets/lux_feedback.dart';
import '../widgets/lux_text_field.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _name.text = FirebaseAuth.instance.currentUser?.displayName ?? '';
    _loadPhone();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _loadPhone() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    try {
      final snap =
          await FirebaseFirestore.instance.collection('users').doc(uid).get();
      final phone = snap.data()?['phone'];
      if (phone is String && mounted) {
        setState(() => _phone.text = phone);
      }
    } catch (_) {}
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await AuthService.instance.updateMyProfile(
        displayName: _name.text,
        phone: _phone.text,
      );
      if (!mounted) return;
      LuxFeedback.success(context, 'Driver profile updated');
    } catch (e) {
      if (!mounted) return;
      LuxFeedback.error(context, e, fallback: AuthService.instance.mapError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signOut() async {
    await AuthService.instance.signOut();
    if (!mounted) return;
    context.go('/auth');
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return Scaffold(
        backgroundColor: LuxColors.background,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(LuxSpacing.screenH),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Profile', style: LuxTypography.display(context)),
                const SizedBox(height: LuxSpacing.sm),
                const Text(
                  'Sign in to manage your chauffeur profile.',
                  style: LuxTypography.bodyMuted,
                ),
                const SizedBox(height: LuxSpacing.lg),
                LuxPrimaryButton(
                  label: 'Sign in',
                  onPressed: () => context.go('/auth'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final hasPassword =
        user.providerData.any((p) => p.providerId == 'password');

    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 100),
          children: [
            LuxScreenHeader(
              title: 'Profile',
              onBack: () => context.pop(),
            ),
            const SizedBox(height: 8),
            Text('Driver profile', style: LuxTypography.display(context)),
            const SizedBox(height: 6),
            Text(
              FirebaseBootstrap.usingEmulators
                  ? 'Chauffeur account · Auth emulator'
                  : 'Chauffeur account · Live Firebase',
              style: LuxTypography.bodyMuted,
            ),
            const SizedBox(height: LuxSpacing.md),
            StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance
                  .collection('drivers')
                  .doc(user.uid)
                  .snapshots(),
              builder: (context, snap) {
                final data = snap.data?.data();
                final status = data?['status'] as String? ?? 'UNKNOWN';
                final online = data?['onlineState'] as String? ?? 'OFFLINE';
                return LuxCard(
                  color: LuxColors.lime.withValues(alpha: 0.35),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.email ?? 'No email',
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Status · $status',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        'Online · $online',
                        style: const TextStyle(color: LuxColors.muted),
                      ),
                      if (status == 'PENDING') ...[
                        const SizedBox(height: 10),
                        const Text(
                          'Complete vehicle & documents, then wait for ops approval before going online.',
                          style: TextStyle(height: 1.35),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: LuxSpacing.md),
            Form(
              key: _form,
              child: Column(
                children: [
                  LuxTextField(
                    controller: _name,
                    label: 'Display name',
                    prefixIcon: Icons.badge_outlined,
                    enabled: !_busy,
                    textCapitalization: TextCapitalization.words,
                    validator: LuxValidators.name,
                  ),
                  const SizedBox(height: LuxSpacing.fieldGap),
                  LuxTextField(
                    controller: _phone,
                    label: 'Phone (optional)',
                    prefixIcon: Icons.phone_outlined,
                    enabled: !_busy,
                    keyboardType: TextInputType.phone,
                    validator: LuxValidators.phone,
                  ),
                ],
              ),
            ),
            const SizedBox(height: LuxSpacing.md),
            LuxPrimaryButton(
              label: 'Save profile',
              loading: _busy,
              onPressed: _save,
            ),
            const SizedBox(height: LuxSpacing.md),
            LuxCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    title: const Text('Vehicle & documents'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/vehicle-docs'),
                  ),
                  if (hasPassword)
                    ListTile(
                      title: const Text('Change password'),
                      subtitle: const Text('Email a reset link'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: _busy
                          ? null
                          : () async {
                              setState(() => _busy = true);
                              try {
                                await AuthService.instance
                                    .sendPasswordResetEmail(user.email ?? '');
                                if (!mounted) return;
                                LuxFeedback.success(
                                  context,
                                  'Password reset email sent',
                                );
                              } catch (e) {
                                if (!mounted) return;
                                LuxFeedback.error(
                                  context,
                                  e,
                                  fallback: AuthService.instance.mapError(e),
                                );
                              } finally {
                                if (mounted) setState(() => _busy = false);
                              }
                            },
                    ),
                  ListTile(
                    title: const Text('Reset with code'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/auth/reset'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: LuxSpacing.lg),
            LuxSecondaryButton(
              label: 'Sign out',
              enabled: !_busy,
              onPressed: _signOut,
            ),
          ],
        ),
      ),
    );
  }
}
