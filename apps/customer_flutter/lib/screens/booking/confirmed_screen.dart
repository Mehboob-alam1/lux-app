import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme/lux_colors.dart';
import '../../widgets/lux_chrome.dart';

class ConfirmedScreen extends StatelessWidget {
  const ConfirmedScreen({super.key, this.bookingId});
  final String? bookingId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 88,
                height: 88,
                decoration: const BoxDecoration(
                  color: LuxColors.lime,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded, size: 44),
              ),
              const SizedBox(height: 20),
              const Text('Booking confirmed',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
              const SizedBox(height: 10),
              Text(bookingId ?? '—',
                  style: const TextStyle(
                      color: LuxColors.muted, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              const Text(
                'Status ASSIGNMENT_PENDING — dispatch will create driver offers.',
                textAlign: TextAlign.center,
                style: TextStyle(color: LuxColors.muted),
              ),
              const Spacer(),
              LuxPrimaryButton(
                label: 'View trip',
                onPressed: () => context.go('/trips/${bookingId ?? ''}'),
              ),
              TextButton(
                onPressed: () => context.go('/home'),
                child: const Text('Home'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
