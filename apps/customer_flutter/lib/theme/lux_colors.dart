import 'package:flutter/material.dart';

/// LUX semantic color tokens — light luxury mobility palette.
/// Contrast: ink on ivory/lime; white on ink; muted on ivory (AA for body).
abstract final class LuxColors {
  // Brand
  static const lime = Color(0xFFC7F36B);
  static const limeDeep = Color(0xFFA8D94A);
  static const ink = Color(0xFF111813);
  static const inkSoft = Color(0xFF202A23);

  // Surfaces
  static const ivory = Color(0xFFFAFBF7);
  static const background = Color(0xFFFAFBF7);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF1F4ED);
  static const surfaceElevated = Color(0xFFFFFFFF);

  // Text
  static const textPrimary = Color(0xFF111813);
  static const textSecondary = Color(0xFF647067);
  static const muted = Color(0xFF647067);
  static const mutedSoft = Color(0xFF8A948C);
  static const textOnLime = Color(0xFF111813);
  static const textOnInk = Color(0xFFFAFBF7);

  // Lines
  static const line = Color(0xFFE2E8E0);
  static const lineStrong = Color(0xFFC9D2C8);
  static const focusRing = Color(0xFF111813);

  // Semantic
  static const success = Color(0xFF21865A);
  static const successSoft = Color(0xFFE6F5EE);
  static const warning = Color(0xFFB7791F);
  static const warningSoft = Color(0xFFFBF0DC);
  static const error = Color(0xFFC83D45);
  static const errorSoft = Color(0xFFF9E8E9);
  static const info = Color(0xFF3478C0);
  static const infoSoft = Color(0xFFE8F1FA);

  // Legacy aliases (existing screens)
  static const danger = error;
  static const chipIdle = surface;
  static const ok = success;

  // Status — booking
  static const statusPending = Color(0xFFB7791F);
  static const statusAssigned = Color(0xFF3478C0);
  static const statusActive = Color(0xFF21865A);
  static const statusComplete = Color(0xFF647067);
  static const statusCancelled = Color(0xFFC83D45);

  // Status — driver
  static const driverOnline = Color(0xFF21865A);
  static const driverOffline = Color(0xFF8A948C);

  // Disabled
  static const disabledBg = Color(0xFFE8EDE6);
  static const disabledFg = Color(0xFF9AA39C);
}
