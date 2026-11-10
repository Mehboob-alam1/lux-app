import 'package:go_router/go_router.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/auth/reset_password_screen.dart';
import 'screens/auth/sign_in_screen.dart';
import 'screens/auth/sign_up_screen.dart';
import 'maps/lux_map_args.dart';
import 'screens/booking/book_flow_screen.dart';
import 'screens/booking/confirmed_screen.dart';
import 'screens/home_screen.dart';
import 'screens/map/lux_full_map_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/support/support_case_chat_screen.dart';
import 'screens/support_screen.dart';
import 'screens/trip_chat_screen.dart';
import 'screens/trip_detail_screen.dart';
import 'screens/trips_screen.dart';
import 'shell/customer_shell.dart';

final customerRouter = GoRouter(
  initialLocation: '/splash',
  routes: [
    GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
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
    GoRoute(
      path: '/trips/:id/chat',
      builder: (_, state) =>
          TripChatScreen(bookingId: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/support/:caseId',
      builder: (_, state) => SupportCaseChatScreen(
        caseId: state.pathParameters['caseId']!,
      ),
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
