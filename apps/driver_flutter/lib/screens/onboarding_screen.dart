import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/driver_api.dart';
import '../services/firebase_bootstrap.dart';
import '../theme/lux_colors.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  bool busy = false;
  String? error;

  Future<void> _enter() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (FirebaseAuth.instance.currentUser == null) {
        await DriverApi.instance.ensureSignedIn();
      }
      if (!mounted) return;
      context.go('/my-day');
    } catch (e) {
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Spacer(),
              Container(
                width: 72,
                height: 72,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: LuxColors.lime,
                  shape: BoxShape.circle,
                ),
                child: const Text('L',
                    style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900)),
              ),
              const SizedBox(height: 20),
              const Text('LUX Driver',
                  style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.8)),
              const SizedBox(height: 10),
              Text(
                FirebaseBootstrap.ready
                    ? 'Sign in as driver@lux.test (seed) via Auth emulator'
                    : 'Firebase not ready — start emulators + seed',
                style: const TextStyle(color: LuxColors.muted, height: 1.4),
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(error!, style: const TextStyle(color: LuxColors.danger)),
              ],
              const Spacer(),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: FilledButton(
                  onPressed: busy ? null : _enter,
                  style: FilledButton.styleFrom(
                    backgroundColor: LuxColors.lime,
                    foregroundColor: LuxColors.ink,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18)),
                  ),
                  child: Text(busy ? 'Signing in…' : 'Sign in & continue',
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
