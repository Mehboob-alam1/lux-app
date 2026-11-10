import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_router.dart';
import 'services/firebase_bootstrap.dart';
import 'services/push_notification_service.dart';
import 'theme/lux_colors.dart';
import 'theme/lux_theme.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Data-only handling; navigation happens on tap via getInitialMessage /
  // onMessageOpenedApp after the app resumes.
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );
  await FirebaseBootstrap.init();
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  PushNotificationService.attachRouter(customerRouter);
  await PushNotificationService.init();
  runApp(const ProviderScope(child: LuxCustomerApp()));
}

class LuxCustomerApp extends StatelessWidget {
  const LuxCustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'LUX',
      debugShowCheckedModeBanner: false,
      theme: luxCustomerTheme(),
      routerConfig: customerRouter,
      builder: (context, child) => LuxPushBannerHost(
        child: ColoredBox(
          color: LuxColors.background,
          child: child ?? const SizedBox.shrink(),
        ),
      ),
    );
  }
}
