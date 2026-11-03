import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lux_driver/screens/onboarding_screen.dart';
import 'package:lux_driver/theme/driver_theme.dart';

void main() {
  testWidgets('Driver onboarding shows brand', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: driverTheme(),
        home: const OnboardingScreen(),
      ),
    );
    expect(find.text('LUX Driver'), findsOneWidget);
    expect(find.text('Continue to My Day'), findsOneWidget);
  });
}
