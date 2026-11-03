import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app_router.dart';
import 'services/firebase_bootstrap.dart';
import 'theme/driver_theme.dart';
import 'theme/lux_colors.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
  ));
  await FirebaseBootstrap.init();
  runApp(const ProviderScope(child: LuxDriverApp()));
}

class LuxDriverApp extends StatelessWidget {
  const LuxDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'LUX Driver',
      debugShowCheckedModeBanner: false,
      theme: driverTheme(),
      routerConfig: driverRouter,
      builder: (context, child) => ColoredBox(
        color: LuxColors.background,
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
