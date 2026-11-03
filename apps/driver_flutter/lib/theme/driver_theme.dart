import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'lux_colors.dart';

ThemeData driverTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: LuxColors.background,
    colorScheme: const ColorScheme.light(
      primary: LuxColors.ink,
      secondary: LuxColors.lime,
      surface: LuxColors.surface,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: LuxColors.background,
      foregroundColor: LuxColors.ink,
      elevation: 0,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: LuxColors.ink,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(56),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
      ),
    ),
  );
}
