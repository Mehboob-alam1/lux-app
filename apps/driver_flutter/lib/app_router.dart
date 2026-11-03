import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'screens/onboarding_screen.dart';
import 'screens/my_day_screen.dart';
import 'screens/opportunities_screen.dart';
import 'screens/trips_screen.dart';
import 'screens/earnings_screen.dart';
import 'screens/performance_screen.dart';
import 'screens/vehicle_docs_screen.dart';
import 'screens/help_safety_screen.dart';
import 'screens/active_trip_screen.dart';
import 'shell/driver_shell.dart';

final driverRouter = GoRouter(
  initialLocation: '/onboarding',
  routes: [
    GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingScreen()),
    GoRoute(
      path: '/active-trip/:id',
      builder: (_, s) => ActiveTripScreen(bookingId: s.pathParameters['id']!),
    ),
    GoRoute(path: '/performance', builder: (_, __) => const PerformanceScreen()),
    GoRoute(path: '/vehicle-docs', builder: (_, __) => const VehicleDocsScreen()),
    GoRoute(path: '/help-safety', builder: (_, __) => const HelpSafetyScreen()),
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
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Text(
              'More',
              style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 16),
            ListTile(
              title: const Text('Performance'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/performance'),
            ),
            ListTile(
              title: const Text('Vehicle & Documents'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/vehicle-docs'),
            ),
            ListTile(
              title: const Text('Help & Safety'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/help-safety'),
            ),
          ],
        ),
      ),
    );
  }
}
