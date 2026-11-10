import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/auth_service.dart';
import '../../theme/lux_colors.dart';
import '../../theme/lux_spacing.dart';
import '../../theme/lux_typography.dart';
import '../../widgets/lux_chrome.dart';
import '../../widgets/lux_feedback.dart';
import '../../widgets/lux_text_field.dart';

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  bool _accepted = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      LuxFeedback.success(context, 'Welcome to LUX');
      context.go('/home');
    } catch (e) {
      if (!mounted) return;
      LuxFeedback.error(context, e, fallback: AuthService.instance.mapError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            LuxSpacing.screenH,
            LuxSpacing.sm,
            LuxSpacing.screenH,
            LuxSpacing.xl,
          ),
          children: [
            LuxScreenHeader(
              title: 'Create account',
              onBack: () => context.pop(),
            ),
            const SizedBox(height: LuxSpacing.xs),
            Text('Join LUX', style: LuxTypography.display(context)),
            const SizedBox(height: LuxSpacing.xs),
            const Text(
              'Set up your rider profile to book airport transfers and city rides.',
              style: LuxTypography.bodyMuted,
            ),
            const SizedBox(height: LuxSpacing.lg),
            Form(
              key: _form,
              child: Column(
                children: [
                  LuxTextField(
                    controller: _name,
                    label: 'Full name',
                    prefixIcon: Icons.person_outline,
                    enabled: !_busy,
                    textCapitalization: TextCapitalization.words,
                    autofillHints: const [AutofillHints.name],
                    validator: LuxValidators.name,
                  ),
                  const SizedBox(height: LuxSpacing.fieldGap),
                  LuxTextField(
                    controller: _email,
                    label: 'Email',
                    prefixIcon: Icons.mail_outline,
                    enabled: !_busy,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    validator: LuxValidators.email,
                  ),
                  const SizedBox(height: LuxSpacing.fieldGap),
                  LuxTextField(
                    controller: _password,
                    label: 'Password',
                    prefixIcon: Icons.lock_outline,
                    enabled: !_busy,
                    obscureText: true,
                    enableObscureToggle: true,
                    autofillHints: const [AutofillHints.newPassword],
                    validator: LuxValidators.password,
                  ),
                  const SizedBox(height: LuxSpacing.fieldGap),
                  LuxTextField(
                    controller: _confirm,
                    label: 'Confirm password',
                    prefixIcon: Icons.lock_outline,
                    enabled: !_busy,
                    obscureText: true,
                    enableObscureToggle: true,
                    validator: (v) {
                      if (v != _password.text) {
                        return 'Passwords do not match.';
                      }
                      return null;
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: LuxSpacing.sm),
            CheckboxListTile(
              value: _accepted,
              onChanged: _busy
                  ? null
                  : (v) => setState(() => _accepted = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              title: const Text(
                'I agree to LUX Terms of Service and Privacy Policy',
                style: TextStyle(fontSize: 13, height: 1.35),
              ),
            ),
            const SizedBox(height: LuxSpacing.sm),
            LuxPrimaryButton(
              label: 'Create account',
              loading: _busy,
              onPressed: () {
                if (!(_form.currentState?.validate() ?? false)) return;
                if (!_accepted) {
                  LuxFeedback.error(
                    context,
                    'Please accept the terms to continue.',
                  );
                  return;
                }
                _run(() async {
                  await AuthService.instance.signUpWithEmail(
                    email: _email.text,
                    password: _password.text,
                    displayName: _name.text,
                  );
                });
              },
            ),
            const SizedBox(height: LuxSpacing.sm),
            LuxSecondaryButton(
              label: 'Sign up with Google',
              enabled: !_busy,
              onPressed: () => _run(() async {
                await AuthService.instance.signInWithGoogle();
              }),
            ),
            const SizedBox(height: LuxSpacing.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'Already have an account?',
                  style: TextStyle(color: LuxColors.muted),
                ),
                TextButton(
                  onPressed: _busy ? null : () => context.go('/auth'),
                  child: const Text(
                    'Sign in',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
