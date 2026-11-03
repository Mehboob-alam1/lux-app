import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app_router.dart';
import 'services/firebase_bootstrap.dart';
import 'theme/lux_colors.dart';
import 'theme/lux_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );
  // Default: Auth/Firestore/Functions emulators (docs). Live: --dart-define=USE_EMULATORS=false
  await FirebaseBootstrap.init();
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
      builder: (context, child) => ColoredBox(
        color: LuxColors.background,
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
