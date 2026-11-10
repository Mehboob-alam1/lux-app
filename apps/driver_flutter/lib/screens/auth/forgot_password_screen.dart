import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/auth_service.dart';
import '../../theme/lux_colors.dart';
import '../../theme/lux_spacing.dart';
import '../../theme/lux_typography.dart';
import '../../widgets/lux_chrome.dart';
import '../../widgets/lux_feedback.dart';
import '../../widgets/lux_text_field.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await AuthService.instance.sendPasswordResetEmail(_email.text);
      if (!mounted) return;
      LuxFeedback.success(
        context,
        'Reset email sent. Use the link or code to set a new password.',
      );
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
              title: 'Forgot password',
              onBack: () => context.pop(),
            ),
            const SizedBox(height: LuxSpacing.xs),
            Text('Recover access', style: LuxTypography.display(context)),
            const SizedBox(height: LuxSpacing.xs),
            const Text(
              'Enter the email on your LUX driver account.',
              style: LuxTypography.bodyMuted,
            ),
            const SizedBox(height: LuxSpacing.lg),
            Form(
              key: _form,
              child: LuxTextField(
                controller: _email,
                label: 'Email',
                prefixIcon: Icons.mail_outline,
                enabled: !_busy,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                validator: LuxValidators.email,
              ),
            ),
            const SizedBox(height: LuxSpacing.md),
            LuxPrimaryButton(
              label: 'Send reset email',
              loading: _busy,
              onPressed: _submit,
            ),
            TextButton(
              onPressed: _busy
                  ? null
                  : () => context.push(
                        '/auth/reset',
                        extra: _email.text.trim(),
                      ),
              child: const Text('I already have a reset code'),
            ),
          ],
        ),
      ),
    );
  }
}
