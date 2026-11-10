import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/booking_api.dart';
import '../services/firebase_bootstrap.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../utils/booking_ui.dart';
import '../widgets/lux_chrome.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final name = user?.displayName?.trim().isNotEmpty == true
        ? user!.displayName!.trim()
        : (user?.email ?? 'Guest');

    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 100),
          children: [
            Text(
              name,
              style: LuxTypography.caption.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text('Book a transfer', style: LuxTypography.display(context)),
            const SizedBox(height: 8),
            Text(
              FirebaseBootstrap.usingEmulators
                  ? 'Live quotes via Cloud Functions · emulator'
                  : 'Airport & city transfers with confirmed pricing',
              style: LuxTypography.bodyMuted,
            ),
            const SizedBox(height: LuxSpacing.lg),
            LuxCard(
              color: LuxColors.lime.withValues(alpha: 0.45),
              onTap: () => context.push('/book'),
              child: const Row(
                children: [
                  Icon(Icons.local_taxi_outlined, size: 28),
                  SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'New booking',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Pick route, get a server quote, pay & confirm',
                          style: TextStyle(
                            color: LuxColors.inkSoft,
                            fontSize: 13,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.arrow_forward_rounded),
                ],
              ),
            ),
            const SizedBox(height: LuxSpacing.lg),
            const LuxSectionLabel('Active trip'),
            const SizedBox(height: 10),
            StreamBuilder(
              stream: BookingApi.instance.watchMyBookings(),
              builder: (context, snap) {
                if (snap.hasError) {
                  return LuxCard(
                    child: Text(
                      BookingApi.instance.mapError(snap.error!),
                      style: const TextStyle(color: LuxColors.danger),
                    ),
                  );
                }
                final rows = snap.data ?? const <Map<String, dynamic>>[];
                final active = rows
                    .where((r) => BookingUi.isActive(r['currentStatus'] as String?))
                    .toList();
                if (active.isEmpty) {
                  return LuxEmptyState(
                    title: 'No active bookings',
                    body: 'When you confirm a trip, it will show up here.',
                    icon: Icons.route_outlined,
                    action: LuxPrimaryButton(
                      label: 'Book now',
                      onPressed: () => context.push('/book'),
                    ),
                  );
                }
                final b = active.first;
                final id = b['bookingId'] as String? ?? '—';
                final status = b['currentStatus'] as String? ?? '—';
                return LuxCard(
                  onTap: () => context.push('/trips/$id'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          LuxStatusPill(
                            label: BookingUi.label(status),
                            color: BookingUi.color(status),
                          ),
                          const Spacer(),
                          Text(
                            BookingUi.fare(b),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        BookingUi.routeSummary(b),
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 17,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        [
                          b['classId']?.toString() ?? '—',
                          if (BookingUi.scheduleLabel(b) != null)
                            BookingUi.scheduleLabel(b)!,
                        ].join(' · '),
                        style: LuxTypography.caption,
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: LuxSpacing.md),
            LuxSecondaryButton(
              label: 'View all trips',
              onPressed: () => context.go('/trips'),
            ),
          ],
        ),
      ),
    );
  }
}
