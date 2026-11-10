import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/auth_service.dart';
import '../../theme/lux_colors.dart';
import '../../widgets/lux_chrome.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, this.oobCode, this.emailHint});

  final String? oobCode;
  final String? emailHint;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;
  bool _busy = false;
  String? _error;
  String? _success;
  String? _verifiedEmail;

  @override
  void initState() {
    super.initState();
    if (widget.oobCode != null && widget.oobCode!.isNotEmpty) {
      _code.text = widget.oobCode!;
      _verifyCode();
    }
  }

  @override
  void dispose() {
    _code.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _verifyCode() async {
    if (_code.text.trim().isEmpty) return;
    try {
      final email =
          await AuthService.instance.verifyPasswordResetCode(_code.text);
      if (!mounted) return;
      setState(() {
        _verifiedEmail = email;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _verifiedEmail = null;
        _error = AuthService.instance.mapError(e);
      });
    }
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() {
      _busy = true;
      _error = null;
      _success = null;
    });
    try {
      await AuthService.instance.confirmPasswordReset(
        code: _code.text,
        newPassword: _password.text,
      );
      setState(() {
        _success = 'Password updated. You can sign in with your new password.';
      });
    } catch (e) {
      setState(() => _error = AuthService.instance.mapError(e));
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
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
          children: [
            LuxScreenHeader(
              title: 'Reset password',
              onBack: () => context.pop(),
            ),
            const SizedBox(height: 8),
            const Text(
              'New password',
              style: TextStyle(
                fontSize: 34,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.6,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _verifiedEmail != null
                  ? 'Resetting password for $_verifiedEmail'
                  : (widget.emailHint?.isNotEmpty == true
                      ? 'Paste the code from the email sent to ${widget.emailHint}'
                      : 'Paste the reset code from your email, then choose a new password.'),
              style: const TextStyle(color: LuxColors.muted, height: 1.4),
            ),
            const SizedBox(height: 24),
            Form(
              key: _form,
              child: LuxCard(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Column(
                  children: [
                    TextFormField(
                      controller: _code,
                      enabled: !_busy,
                      onChanged: (_) => _verifiedEmail = null,
                      decoration: const InputDecoration(
                        labelText: 'Reset code',
                        border: InputBorder.none,
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? 'Reset code is required'
                          : null,
                    ),
                    const Divider(height: 1),
                    TextFormField(
                      controller: _password,
                      enabled: !_busy,
                      obscureText: _obscure,
                      autofillHints: const [AutofillHints.newPassword],
                      decoration: InputDecoration(
                        labelText: 'New password',
                        border: InputBorder.none,
                        suffixIcon: IconButton(
                          onPressed: () =>
                              setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (v) {
                        if (v == null || v.length < 6) {
                          return 'At least 6 characters';
                        }
                        return null;
                      },
                    ),
                    const Divider(height: 1),
                    TextFormField(
                      controller: _confirm,
                      enabled: !_busy,
                      obscureText: _obscure,
                      decoration: const InputDecoration(
                        labelText: 'Confirm new password',
                        border: InputBorder.none,
                      ),
                      validator: (v) {
                        if (v != _password.text) {
                          return 'Passwords do not match';
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            LuxPrimaryButton(
              label: _busy ? 'Updating…' : 'Update password',
              enabled: !_busy,
              onPressed: _submit,
            ),
            const SizedBox(height: 12),
            LuxPrimaryButton(
              label: 'Back to sign in',
              enabled: !_busy,
              onPressed: () => context.go('/auth'),
            ),
            if (_success != null) ...[
              const SizedBox(height: 14),
              Text(_success!,
                  style: const TextStyle(color: Color(0xFF2F7D32), height: 1.4)),
            ],
            if (_error != null) ...[
              const SizedBox(height: 14),
              Text(_error!, style: const TextStyle(color: LuxColors.danger)),
            ],
          ],
        ),
      ),
    );
  }
}
