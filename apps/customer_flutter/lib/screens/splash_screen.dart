import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/app_prefs.dart';
import '../services/firebase_bootstrap.dart';
import '../theme/lux_colors.dart';
import '../widgets/lux_chrome.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  bool _routing = false;

  Future<void> _continue() async {
    if (_routing) return;
    setState(() => _routing = true);
    try {
      final signedIn = FirebaseAuth.instance.currentUser != null;
      if (signedIn) {
        if (!mounted) return;
        context.go('/home');
        return;
      }
      final done = await AppPrefs.hasCompletedOnboarding();
      if (!mounted) return;
      context.go(done ? '/auth' : '/onboarding');
    } finally {
      if (mounted) setState(() => _routing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = FirebaseAuth.instance.currentUser != null;
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 28),
          child: Column(
            children: [
              const Spacer(flex: 3),
              Container(
                width: 92,
                height: 92,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: LuxColors.lime,
                  shape: BoxShape.circle,
                ),
                child: const Text(
                  'L',
                  style: TextStyle(fontSize: 46, fontWeight: FontWeight.w900),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'LUX',
                style: TextStyle(
                  fontSize: 44,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 3,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                FirebaseBootstrap.ready
                    ? (FirebaseBootstrap.usingEmulators
                        ? 'Firebase emulators connected'
                        : 'Firebase connected')
                    : 'Firebase offline — start emulators to continue',
                textAlign: TextAlign.center,
                style: const TextStyle(color: LuxColors.muted, fontSize: 15),
              ),
              const Spacer(flex: 4),
              LuxPrimaryButton(
                label: signedIn ? 'Continue' : 'Get started',
                loading: _routing,
                onPressed: _continue,
              ),
              if (FirebaseBootstrap.initError != null) ...[
                const SizedBox(height: 12),
                Text(
                  FirebaseBootstrap.initError!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: LuxColors.danger, fontSize: 12),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
