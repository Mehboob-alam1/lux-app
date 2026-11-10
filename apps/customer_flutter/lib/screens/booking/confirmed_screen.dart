import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../theme/lux_colors.dart';
import '../../theme/lux_spacing.dart';
import '../../theme/lux_typography.dart';
import '../../widgets/lux_chrome.dart';

class ConfirmedScreen extends StatelessWidget {
  const ConfirmedScreen({super.key, this.bookingId});
  final String? bookingId;

  @override
  Widget build(BuildContext context) {
    final id = bookingId;
    final valid = id != null && id.isNotEmpty && id != 'pending';

    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(LuxSpacing.screenH),
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
              Text(
                valid ? 'Booking confirmed' : 'Booking submitted',
                style: LuxTypography.display(context),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Text(
                valid ? id : 'Waiting for booking id…',
                style: LuxTypography.caption.copyWith(
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              const Text(
                'Status starts as Assignment pending. Dispatch will create driver offers from eligible chauffeurs.',
                textAlign: TextAlign.center,
                style: LuxTypography.bodyMuted,
              ),
              const Spacer(),
              LuxPrimaryButton(
                label: 'View trip',
                enabled: valid,
                onPressed: () => context.go('/trips/$id'),
              ),
              const SizedBox(height: LuxSpacing.sm),
              LuxSecondaryButton(
                label: 'Back home',
                onPressed: () => context.go('/home'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
