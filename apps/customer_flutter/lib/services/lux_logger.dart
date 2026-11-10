import 'dart:convert';

import 'package:flutter/foundation.dart';

/// Structured client logs (no emails/phones/full names in fields).
class LuxLogger {
  LuxLogger._();

  static const app = 'customer';

  static void info(
    String event, [
    Map<String, Object?> fields = const {},
  ]) =>
      _emit('info', event, fields);

  static void warn(
    String event, [
    Map<String, Object?> fields = const {},
  ]) =>
      _emit('warn', event, fields);

  static void error(
    String event, [
    Map<String, Object?> fields = const {},
    Object? error,
    StackTrace? stack,
  ]) {
    final merged = Map<String, Object?>.from(fields);
    if (error != null) merged['error'] = error.toString();
    if (stack != null && kDebugMode) {
      merged['stack'] = stack.toString().split('\n').take(6).join(' | ');
    }
    _emit('error', event, merged);
  }

  static Future<T> timed<T>(
    String event,
    Future<T> Function() run, {
    Map<String, Object?> fields = const {},
  }) async {
    final started = DateTime.now();
    info('${event}_start', fields);
    try {
      final result = await run();
      info('${event}_ok', {
        ...fields,
        'ms': DateTime.now().difference(started).inMilliseconds,
      });
      return result;
    } catch (e, st) {
      error(
        '${event}_fail',
        {
          ...fields,
          'ms': DateTime.now().difference(started).inMilliseconds,
        },
        e,
        st,
      );
      rethrow;
    }
  }

  static void _emit(
    String level,
    String event,
    Map<String, Object?> fields,
  ) {
    final payload = <String, Object?>{
      'level': level,
      'app': app,
      'event': event,
      'ts': DateTime.now().toUtc().toIso8601String(),
      ...fields,
    };
    final line = jsonEncode(payload);
    switch (level) {
      case 'error':
        debugPrint('LUX_ERROR $line');
      case 'warn':
        debugPrint('LUX_WARN $line');
      default:
        debugPrint('LUX $line');
    }
  }
}
