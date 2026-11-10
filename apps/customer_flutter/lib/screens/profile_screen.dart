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
  bool _loaded = false;
  bool _push = true;
  bool _emailNotif = true;
  bool _sms = false;
  String _lang = 'en';

  @override
  void initState() {
    super.initState();
    _name.text = FirebaseAuth.instance.currentUser?.displayName ?? '';
    _loadProfile();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    try {
      final results = await Future.wait([
        FirebaseFirestore.instance.collection('users').doc(uid).get(),
        FirebaseFirestore.instance
            .collection('customer_profiles')
            .doc(uid)
            .get(),
      ]);
      final userDoc = results[0].data();
      final profile = results[1].data();
      if (!mounted) return;
      setState(() {
        if (profile?['displayName'] is String &&
            (profile!['displayName'] as String).trim().isNotEmpty) {
          _name.text = (profile['displayName'] as String).trim();
        }
        final phone = userDoc?['phone'] ?? profile?['phone'];
        if (phone is String) _phone.text = phone;
        final lang = profile?['preferredLanguage'];
        if (lang is String && lang.isNotEmpty) _lang = lang;
        final notif = profile?['notificationSettings'];
        if (notif is Map) {
          _push = notif['push'] != false;
          _emailNotif = notif['email'] != false;
          _sms = notif['sms'] == true;
        }
        _loaded = true;
      });
    } catch (_) {
      if (mounted) setState(() => _loaded = true);
    }
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await AuthService.instance.updateMyProfile(
        displayName: _name.text,
        phone: _phone.text,
        preferredLanguage: _lang,
        pushNotifications: _push,
        emailNotifications: _emailNotif,
        smsNotifications: _sms,
      );
      if (!mounted) return;
      LuxFeedback.success(context, 'Profile updated');
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
                  'Sign in to manage your rider profile.',
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

    final providers = user.providerData.map((p) => p.providerId).toSet();
    final hasPassword = providers.contains('password');

    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 100),
          children: [
            Text('Profile', style: LuxTypography.display(context)),
            const SizedBox(height: 6),
            Text(
              FirebaseBootstrap.usingEmulators
                  ? 'Rider account · Auth emulator'
                  : 'Rider account · Live Firebase',
              style: LuxTypography.bodyMuted,
            ),
            const SizedBox(height: LuxSpacing.md),
            LuxCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: LuxColors.lime,
                    backgroundImage: user.photoURL != null
                        ? NetworkImage(user.photoURL!)
                        : null,
                    child: user.photoURL == null
                        ? Text(
                            () {
                              final raw =
                                  (user.displayName ?? user.email ?? 'L')
                                      .trim();
                              return raw.isEmpty
                                  ? 'L'
                                  : raw.substring(0, 1).toUpperCase();
                            }(),
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 22,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.email ?? 'No email',
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          user.emailVerified
                              ? 'Email verified'
                              : 'Email not verified',
                          style: TextStyle(
                            color: user.emailVerified
                                ? const Color(0xFF2F7D32)
                                : LuxColors.muted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: LuxSpacing.md),
            const LuxSectionLabel('Details'),
            const SizedBox(height: 8),
            Form(
              key: _form,
              child: Column(
                children: [
                  LuxTextField(
                    controller: _name,
                    label: 'Display name',
                    hint: 'Name shown on bookings',
                    prefixIcon: Icons.badge_outlined,
                    enabled: !_busy,
                    textCapitalization: TextCapitalization.words,
                    validator: LuxValidators.name,
                  ),
                  const SizedBox(height: LuxSpacing.fieldGap),
                  LuxTextField(
                    controller: _phone,
                    label: 'Phone (optional)',
                    hint: '+1 …',
                    prefixIcon: Icons.phone_outlined,
                    enabled: !_busy,
                    keyboardType: TextInputType.phone,
                    validator: LuxValidators.phone,
                  ),
                ],
              ),
            ),
            const SizedBox(height: LuxSpacing.md),
            const LuxSectionLabel('Preferences'),
            const SizedBox(height: 8),
            LuxCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    title: const Text('Language'),
                    subtitle: Text(_lang == 'fr' ? 'Français' : 'English'),
                    trailing: DropdownButton<String>(
                      value: _lang,
                      underline: const SizedBox.shrink(),
                      items: const [
                        DropdownMenuItem(value: 'en', child: Text('EN')),
                        DropdownMenuItem(value: 'fr', child: Text('FR')),
                      ],
                      onChanged: _busy
                          ? null
                          : (v) {
                              if (v != null) setState(() => _lang = v);
                            },
                    ),
                  ),
                  SwitchListTile(
                    title: const Text('Push notifications'),
                    value: _push,
                    onChanged: _busy
                        ? null
                        : (v) => setState(() => _push = v),
                  ),
                  SwitchListTile(
                    title: const Text('Email notifications'),
                    value: _emailNotif,
                    onChanged: _busy
                        ? null
                        : (v) => setState(() => _emailNotif = v),
                  ),
                  SwitchListTile(
                    title: const Text('SMS notifications'),
                    value: _sms,
                    onChanged:
                        _busy ? null : (v) => setState(() => _sms = v),
                  ),
                ],
              ),
            ),
            if (!_loaded) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(minHeight: 2),
            ],
            const SizedBox(height: LuxSpacing.md),
            LuxPrimaryButton(
              label: 'Save profile',
              loading: _busy,
              onPressed: _save,
            ),
            const SizedBox(height: LuxSpacing.md),
            const LuxSectionLabel('Security'),
            const SizedBox(height: 8),
            LuxCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  if (hasPassword)
                    ListTile(
                      title: const Text('Change password'),
                      subtitle: const Text('Email a reset link to yourself'),
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
                    subtitle: const Text('Paste a Firebase reset code'),
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
