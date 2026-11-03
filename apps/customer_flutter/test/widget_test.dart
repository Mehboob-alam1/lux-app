import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lux_customer/screens/splash_screen.dart';
import 'package:flutter/material.dart';
import 'package:lux_customer/theme/lux_theme.dart';

void main() {
  testWidgets('Splash shows LUX brand', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: luxCustomerTheme(),
          home: const SplashScreen(),
        ),
      ),
    );
    expect(find.text('LUX'), findsOneWidget);
    expect(find.text('Get started'), findsOneWidget);
  });
}
