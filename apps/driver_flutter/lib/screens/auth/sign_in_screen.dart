import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/auth_service.dart';
import '../../theme/lux_colors.dart';
import '../../theme/lux_spacing.dart';
import '../../theme/lux_typography.dart';
import '../../widgets/lux_chrome.dart';
import '../../widgets/lux_feedback.dart';
import '../../widgets/lux_text_field.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      LuxFeedback.success(context, 'Signed in');
      context.go('/my-day');
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
            const LuxScreenHeader(title: 'Driver access'),
            const SizedBox(height: LuxSpacing.xs),
            Text('Sign in', style: LuxTypography.display(context)),
            const SizedBox(height: LuxSpacing.xs),
            const Text(
              'Go online, accept offers, and complete premium transfers.',
              style: LuxTypography.bodyMuted,
            ),
            const SizedBox(height: LuxSpacing.lg),
            Form(
              key: _form,
              child: Column(
                children: [
                  LuxTextField(
                    controller: _email,
                    label: 'Email',
                    hint: 'driver@example.com',
                    prefixIcon: Icons.mail_outline,
                    enabled: !_busy,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.email],
                    validator: LuxValidators.email,
                  ),
                  const SizedBox(height: LuxSpacing.fieldGap),
                  LuxTextField(
                    controller: _password,
                    label: 'Password',
                    hint: 'Your password',
                    prefixIcon: Icons.lock_outline,
                    enabled: !_busy,
                    obscureText: true,
                    enableObscureToggle: true,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.password],
                    validator: LuxValidators.password,
                  ),
                ],
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: _busy ? null : () => context.push('/auth/forgot'),
                child: const Text('Forgot password?'),
              ),
            ),
            const SizedBox(height: LuxSpacing.sm),
            LuxPrimaryButton(
              label: 'Sign in',
              loading: _busy,
              onPressed: () {
                if (!(_form.currentState?.validate() ?? false)) return;
                _run(() async {
                  await AuthService.instance.signInWithEmail(
                    email: _email.text,
                    password: _password.text,
                  );
                });
              },
            ),
            const SizedBox(height: LuxSpacing.sm),
            LuxSecondaryButton(
              label: 'Continue with Google',
              enabled: !_busy,
              onPressed: () => _run(() async {
                await AuthService.instance.signInWithGoogle();
              }),
            ),
            const SizedBox(height: LuxSpacing.md),
            TextButton(
              onPressed: _busy ? null : () => context.push('/auth/signup'),
              child: const Text('Create driver account'),
            ),
          ],
        ),
      ),
    );
  }
}
