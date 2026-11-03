import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'lux_colors.dart';

ThemeData luxCustomerTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: LuxColors.background,
    colorScheme: const ColorScheme.light(
      primary: LuxColors.ink,
      secondary: LuxColors.lime,
      surface: LuxColors.surface,
      onPrimary: LuxColors.surface,
      onSecondary: LuxColors.ink,
      onSurface: LuxColors.ink,
    ),
    fontFamily: '.SF Pro Text',
    dividerColor: LuxColors.line,
  );

  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: LuxColors.background,
      foregroundColor: LuxColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
      centerTitle: false,
    ),
    textTheme: base.textTheme.apply(
      bodyColor: LuxColors.ink,
      displayColor: LuxColors.ink,
      fontFamily: '.SF Pro Text',
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: LuxColors.ink,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(56),
        elevation: 0,
        shape: const StadiumBorder(),
        textStyle: const TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
        ),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: LuxColors.surface,
      selectedColor: LuxColors.lime,
      labelStyle: const TextStyle(
        color: LuxColors.ink,
        fontWeight: FontWeight.w600,
      ),
      shape: const StadiumBorder(
        side: BorderSide(color: LuxColors.line),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    ),
    cardTheme: CardThemeData(
      color: LuxColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      margin: EdgeInsets.zero,
    ),
  );
}
