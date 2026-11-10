import 'package:flutter/material.dart';
import 'lux_colors.dart';

/// Typography scale for LUX customer / driver (system UI fonts with premium weights).
abstract final class LuxTypography {
  static const _family = null; // platform default (SF / Roboto)

  static TextStyle display(BuildContext? context) => const TextStyle(
        fontFamily: _family,
        fontSize: 34,
        fontWeight: FontWeight.w900,
        letterSpacing: -0.8,
        height: 1.1,
        color: LuxColors.textPrimary,
      );

  static TextStyle pageTitle = const TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w900,
    letterSpacing: -0.6,
    height: 1.15,
    color: LuxColors.textPrimary,
  );

  static TextStyle sectionTitle = const TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.3,
    height: 1.25,
    color: LuxColors.textPrimary,
  );

  static TextStyle cardTitle = const TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.2,
    height: 1.3,
    color: LuxColors.textPrimary,
  );

  static TextStyle body = const TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w500,
    height: 1.45,
    color: LuxColors.textPrimary,
  );

  static const bodyMuted = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w500,
    height: 1.45,
    color: LuxColors.textSecondary,
  );

  static const caption = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    height: 1.35,
    color: LuxColors.textSecondary,
  );

  static TextStyle label = const TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.1,
    color: LuxColors.textSecondary,
  );

  static TextStyle button = const TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w800,
    letterSpacing: 0.15,
    height: 1.2,
  );

  static TextStyle status = const TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w800,
    letterSpacing: 0.4,
  );
}
