import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'maps/lux_map_args.dart';
import 'screens/active_trip_screen.dart';
import 'theme/lux_colors.dart';
import 'theme/lux_typography.dart';
import 'widgets/lux_chrome.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/auth/reset_password_screen.dart';
import 'screens/auth/sign_in_screen.dart';
import 'screens/auth/sign_up_screen.dart';
import 'screens/earnings_screen.dart';
import 'screens/help_safety_screen.dart';
import 'screens/map/lux_full_map_screen.dart';
import 'screens/my_day_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/opportunities_screen.dart';
import 'screens/performance_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/support/support_case_chat_screen.dart';
import 'screens/trip_chat_screen.dart';
import 'screens/trips_screen.dart';
import 'screens/vehicle_docs_screen.dart';
import 'shell/driver_shell.dart';

final driverRouter = GoRouter(
  initialLocation: '/onboarding',
  routes: [
    GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingScreen()),
    GoRoute(path: '/auth', builder: (_, __) => const SignInScreen()),
    GoRoute(path: '/auth/signup', builder: (_, __) => const SignUpScreen()),
    GoRoute(
      path: '/auth/forgot',
      builder: (_, __) => const ForgotPasswordScreen(),
    ),
    GoRoute(
      path: '/auth/reset',
      builder: (_, state) => ResetPasswordScreen(
        oobCode: state.uri.queryParameters['oobCode'] ??
            state.uri.queryParameters['code'],
        emailHint: state.extra is String ? state.extra as String : null,
      ),
    ),
    GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
    GoRoute(
      path: '/map',
      builder: (_, state) {
        final extra = state.extra;
        final args = extra is LuxMapArgs
            ? extra
            : LuxMapArgs.fromQuery(state.uri.queryParameters);
        return LuxFullMapScreen(args: args);
      },
    ),
    GoRoute(
      path: '/active-trip/:id',
      builder: (_, s) => ActiveTripScreen(bookingId: s.pathParameters['id']!),
    ),
    GoRoute(
      path: '/active-trip/:id/chat',
      builder: (_, s) =>
          TripChatScreen(bookingId: s.pathParameters['id']!),
    ),
    GoRoute(path: '/performance', builder: (_, __) => const PerformanceScreen()),
    GoRoute(path: '/vehicle-docs', builder: (_, __) => const VehicleDocsScreen()),
    GoRoute(path: '/help-safety', builder: (_, __) => const HelpSafetyScreen()),
    GoRoute(
      path: '/help-safety/:caseId',
      builder: (_, s) =>
          SupportCaseChatScreen(caseId: s.pathParameters['caseId']!),
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => DriverShell(navigationShell: shell),
      branches: [
        StatefulShellBranch(routes: [
          GoRoute(path: '/my-day', builder: (_, __) => const MyDayScreen()),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(
            path: '/opportunities',
            builder: (_, __) => const OpportunitiesScreen(),
          ),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/trips', builder: (_, __) => const DriverTripsScreen()),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/earnings', builder: (_, __) => const EarningsScreen()),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/more', builder: (_, __) => const DriverMoreScreen()),
        ]),
      ],
    ),
  ],
);

class DriverMoreScreen extends StatelessWidget {
  const DriverMoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text('More', style: LuxTypography.display(context)),
            const SizedBox(height: 8),
            const Text(
              'Account, vehicle eligibility, and safety.',
              style: LuxTypography.bodyMuted,
            ),
            const SizedBox(height: 16),
            LuxCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    title: const Text('Profile'),
                    subtitle: const Text('Account, password, sign out'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/profile'),
                  ),
                  ListTile(
                    title: const Text('Performance'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/performance'),
                  ),
                  ListTile(
                    title: const Text('Vehicle & Documents'),
                    subtitle: const Text('Live eligibility from Firestore'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/vehicle-docs'),
                  ),
                  ListTile(
                    title: const Text('Help & Safety'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/help-safety'),
                  ),
                  ListTile(
                    title: const Text('Onboarding checklist'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.go('/onboarding'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
