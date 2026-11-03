import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/booking_api.dart';
import '../services/firebase_bootstrap.dart';
import '../theme/lux_colors.dart';
import '../widgets/lux_chrome.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 100),
          children: [
            const Text('Profile',
                style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900)),
            const SizedBox(height: 16),
            LuxCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(user?.email ?? 'Not signed in',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                  const SizedBox(height: 6),
                  Text('uid ${user?.uid ?? '—'}',
                      style: const TextStyle(color: LuxColors.muted, fontSize: 12)),
                  const SizedBox(height: 8),
                  Text(
                    FirebaseBootstrap.usingEmulators
                        ? 'Auth emulator · project lux-dev'
                        : 'Live Firebase',
                    style: const TextStyle(color: LuxColors.muted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            LuxPrimaryButton(
              label: 'Sign out',
              onPressed: () async {
                await BookingApi.instance.signOut();
                if (context.mounted) context.go('/splash');
              },
            ),
          ],
        ),
      ),
    );
  }
}
