import 'package:go_router/go_router.dart';
import 'screens/auth_screen.dart';
import 'screens/booking/book_flow_screen.dart';
import 'screens/booking/confirmed_screen.dart';
import 'screens/home_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/support_screen.dart';
import 'screens/trip_detail_screen.dart';
import 'screens/trips_screen.dart';
import 'shell/customer_shell.dart';

final customerRouter = GoRouter(
  initialLocation: '/splash',
  routes: [
    GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
    GoRoute(path: '/auth', builder: (_, __) => const AuthScreen()),
    GoRoute(
      path: '/book',
      builder: (_, __) => const BookFlowScreen(),
    ),
    GoRoute(
      path: '/book/confirmed',
      builder: (_, state) => ConfirmedScreen(
        bookingId: state.uri.queryParameters['bookingId'],
      ),
    ),
    GoRoute(
      path: '/trips/:id',
      builder: (_, state) =>
          TripDetailScreen(bookingId: state.pathParameters['id']!),
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) =>
          CustomerShell(navigationShell: navigationShell),
      branches: [
        StatefulShellBranch(routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/trips', builder: (_, __) => const TripsScreen()),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/support', builder: (_, __) => const SupportScreen()),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
        ]),
      ],
    ),
  ],
);
