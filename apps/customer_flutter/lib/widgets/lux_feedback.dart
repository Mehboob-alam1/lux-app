import 'package:flutter/material.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';

enum LuxToastKind { success, error, warning, info }

/// Central snackbar / toast feedback — no raw exception dumps.
abstract final class LuxFeedback {
  static ScaffoldFeatureController<SnackBar, SnackBarClosedReason>? _active;

  static void show(
    BuildContext context, {
    required String message,
    LuxToastKind kind = LuxToastKind.info,
    String? actionLabel,
    VoidCallback? onAction,
    Duration? duration,
    bool force = false,
  }) {
    if (!context.mounted) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;

    if (!force && _active != null) {
      // Avoid stacking identical noise during rapid taps.
    }
    messenger.clearSnackBars();

    final (bg, icon) = switch (kind) {
      LuxToastKind.success => (LuxColors.success, Icons.check_circle_outline),
      LuxToastKind.error => (LuxColors.error, Icons.error_outline),
      LuxToastKind.warning => (LuxColors.warning, Icons.warning_amber_rounded),
      LuxToastKind.info => (LuxColors.ink, Icons.info_outline),
    };

    _active = messenger.showSnackBar(
      SnackBar(
        duration: duration ??
            (kind == LuxToastKind.error
                ? const Duration(seconds: 5)
                : const Duration(seconds: 3)),
        backgroundColor: bg,
        content: Row(
          children: [
            Icon(icon, color: Colors.white, size: 20),
            const SizedBox(width: LuxSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
        action: actionLabel != null && onAction != null
            ? SnackBarAction(
                label: actionLabel,
                textColor: Colors.white,
                onPressed: onAction,
              )
            : null,
      ),
    );
  }

  static void success(BuildContext context, String message) =>
      show(context, message: message, kind: LuxToastKind.success);

  static void error(
    BuildContext context,
    Object error, {
    String? fallback,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    show(
      context,
      message: humanizeError(error, fallback: fallback),
      kind: LuxToastKind.error,
      actionLabel: actionLabel,
      onAction: onAction,
    );
  }

  static void warning(BuildContext context, String message) =>
      show(context, message: message, kind: LuxToastKind.warning);

  static void info(BuildContext context, String message) =>
      show(context, message: message, kind: LuxToastKind.info);

  /// Maps Firebase / platform errors to plain language.
  static String humanizeError(Object error, {String? fallback}) {
    final raw = error.toString();
    final lower = raw.toLowerCase();

    if (lower.contains('network') || lower.contains('socket')) {
      return 'Network error. Check your connection and try again.';
    }
    if (lower.contains('unauthenticated') || lower.contains('not signed')) {
      return 'Please sign in to continue.';
    }
    if (lower.contains('permission-denied') ||
        lower.contains('permission_denied')) {
      return 'You do not have permission for this action.';
    }
    if (lower.contains('not provisioned')) {
      return 'Your profile is still setting up. Sign out, sign in, then retry.';
    }
    if (lower.contains('unavailable') || lower.contains('deadline')) {
      return 'Service temporarily unavailable. Please try again.';
    }
    if (lower.contains('failed-precondition')) {
      // Prefer server message after the code prefix when present.
      final m = RegExp(r'\]\s*(.+)').firstMatch(raw);
      if (m != null) return m.group(1)!.split('\n').first.trim();
      return fallback ?? 'This action is not available right now.';
    }
    if (lower.contains('invalid-argument')) {
      return 'Some details look invalid. Please review and try again.';
    }
    if (lower.contains('already-exists') || lower.contains('already in use')) {
      return 'That account already exists. Try signing in instead.';
    }
    if (lower.contains('wrong-password') ||
        lower.contains('invalid-credential')) {
      return 'Incorrect email or password.';
    }
    if (lower.contains('user-not-found')) {
      return 'No account found for that email.';
    }
    if (lower.contains('weak-password')) {
      return 'Password must be at least 6 characters.';
    }
    if (lower.contains('cancelled') || lower.contains('canceled')) {
      return 'Cancelled.';
    }

    // Strip FirebaseFunctionsException wrappers / stacks for UI.
    final bracket = RegExp(r'\]\s*([^\n]+)').firstMatch(raw);
    if (bracket != null) {
      final msg = bracket.group(1)!.trim();
      if (msg.isNotEmpty && !msg.startsWith('#')) return msg;
    }

    return fallback ?? 'Something went wrong. Please try again.';
  }
}

/// Blocking progress dialog for multi-step callables.
Future<T?> luxRunBusy<T>(
  BuildContext context, {
  required Future<T> Function() run,
  String message = 'Please wait…',
}) async {
  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => PopScope(
      canPop: false,
      child: AlertDialog(
        content: Row(
          children: [
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
            const SizedBox(width: LuxSpacing.md),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    ),
  );
  try {
    return await run();
  } finally {
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
  }
}
