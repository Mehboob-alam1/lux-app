import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'lux_colors.dart';
import 'lux_spacing.dart';

ThemeData luxCustomerTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: LuxColors.background,
    colorScheme: const ColorScheme.light(
      primary: LuxColors.ink,
      onPrimary: LuxColors.textOnInk,
      secondary: LuxColors.lime,
      onSecondary: LuxColors.textOnLime,
      surface: LuxColors.surface,
      onSurface: LuxColors.textPrimary,
      error: LuxColors.error,
      onError: Colors.white,
      outline: LuxColors.line,
    ),
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
      titleTextStyle: TextStyle(
        color: LuxColors.ink,
        fontSize: 18,
        fontWeight: FontWeight.w800,
      ),
    ),
    textTheme: base.textTheme.apply(
      bodyColor: LuxColors.textPrimary,
      displayColor: LuxColors.textPrimary,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: LuxColors.lime,
        foregroundColor: LuxColors.ink,
        disabledBackgroundColor: LuxColors.disabledBg,
        disabledForegroundColor: LuxColors.disabledFg,
        minimumSize: const Size.fromHeight(LuxSpacing.buttonHeight),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
        ),
        textStyle: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.15,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: LuxColors.ink,
        minimumSize: const Size.fromHeight(LuxSpacing.buttonHeight),
        side: const BorderSide(color: LuxColors.lineStrong),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: LuxColors.inkSoft,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: LuxColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      hintStyle: const TextStyle(
        color: LuxColors.mutedSoft,
        fontWeight: FontWeight.w500,
      ),
      labelStyle: const TextStyle(
        color: LuxColors.textSecondary,
        fontWeight: FontWeight.w600,
      ),
      errorStyle: const TextStyle(
        color: LuxColors.error,
        fontWeight: FontWeight.w600,
        fontSize: 12,
      ),
      helperStyle: const TextStyle(
        color: LuxColors.textSecondary,
        fontSize: 12,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
        borderSide: const BorderSide(color: LuxColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
        borderSide: const BorderSide(color: LuxColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
        borderSide: const BorderSide(color: LuxColors.ink, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
        borderSide: const BorderSide(color: LuxColors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
        borderSide: const BorderSide(color: LuxColors.error, width: 1.5),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
        borderSide: const BorderSide(color: LuxColors.disabledBg),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: LuxColors.surface,
      selectedColor: LuxColors.lime,
      disabledColor: LuxColors.disabledBg,
      labelStyle: const TextStyle(
        color: LuxColors.ink,
        fontWeight: FontWeight.w700,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusPill),
        side: const BorderSide(color: LuxColors.line),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    ),
    cardTheme: CardThemeData(
      color: LuxColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusLg),
        side: const BorderSide(color: LuxColors.line),
      ),
      margin: EdgeInsets.zero,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
      ),
      contentTextStyle: const TextStyle(
        fontWeight: FontWeight.w600,
        fontSize: 14,
        color: LuxColors.textOnInk,
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: LuxColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusLg),
      ),
      titleTextStyle: const TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w800,
        color: LuxColors.ink,
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: LuxColors.ink,
      circularTrackColor: LuxColors.line,
    ),
    dividerTheme: const DividerThemeData(
      color: LuxColors.line,
      thickness: 1,
      space: 1,
    ),
  );
}
