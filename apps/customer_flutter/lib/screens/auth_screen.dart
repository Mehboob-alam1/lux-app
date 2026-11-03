import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/booking_api.dart';
import '../services/firebase_bootstrap.dart';
import '../theme/lux_colors.dart';
import '../widgets/lux_chrome.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _email = TextEditingController(text: 'customer@lux.test');
  final _password = TextEditingController(text: 'LuxTest123!');
  bool busy = false;
  String? notice;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    setState(() {
      busy = true;
      notice = null;
    });
    try {
      if (!FirebaseBootstrap.ready) {
        throw StateError(
          FirebaseBootstrap.initError ??
              'Firebase not ready. Start emulators + seed (see README).',
        );
      }
      await BookingApi.instance.ensureSignedIn(
        email: _email.text.trim(),
        password: _password.text,
      );
      if (!mounted) return;
      context.go('/home');
    } catch (e) {
      setState(() => notice = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          children: [
            const LuxScreenHeader(title: 'Sign in'),
            const SizedBox(height: 8),
            const Text(
              'Firebase Auth',
              style: TextStyle(
                fontSize: 30,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.6,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              FirebaseBootstrap.usingEmulators
                  ? 'Connected to Auth emulator · seed: customer@lux.test'
                  : 'Connected to live Firebase project',
              style: const TextStyle(color: LuxColors.muted, height: 1.35),
            ),
            const SizedBox(height: 24),
            LuxCard(
              child: Column(
                children: [
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      border: InputBorder.none,
                    ),
                  ),
                  const Divider(height: 1),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      border: InputBorder.none,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            LuxPrimaryButton(
              label: busy ? 'Signing in…' : 'Sign in',
              enabled: !busy,
              onPressed: _signIn,
            ),
            if (notice != null) ...[
              const SizedBox(height: 12),
              Text(notice!, style: const TextStyle(color: LuxColors.danger)),
            ],
          ],
        ),
      ),
    );
  }
}
