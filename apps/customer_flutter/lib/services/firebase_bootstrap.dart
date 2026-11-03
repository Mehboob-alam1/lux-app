import 'dart:io' show Platform;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

import '../firebase_options.dart';

class FirebaseBootstrap {
  static bool ready = false;
  static bool usingEmulators = false;
  static String? initError;

  /// Android emulator → host machine. Override: `--dart-define=FIREBASE_EMU_HOST=…`
  static String get emulatorHost {
    const fromEnv = String.fromEnvironment('FIREBASE_EMU_HOST');
    if (fromEnv.isNotEmpty) return fromEnv;
    if (!kIsWeb && Platform.isAndroid) return '10.0.2.2';
    return '127.0.0.1';
  }

  static Future<void> init({bool? useEmulators}) async {
    // Live Firebase by default. Local: `--dart-define=USE_EMULATORS=true`
    final emulators = useEmulators ??
        const bool.fromEnvironment('USE_EMULATORS', defaultValue: false);
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      }
      if (emulators) {
        await _connectEmulators();
        usingEmulators = true;
      }
      ready = true;
      initError = null;
      debugPrint(
        'Firebase ready (emulators=$usingEmulators '
        'project=${DefaultFirebaseOptions.currentPlatform.projectId} '
        'host=$emulatorHost)',
      );
    } catch (e, st) {
      initError = e.toString();
      ready = false;
      debugPrint('Firebase init failed: $e\n$st');
    }
  }

  static Future<void> _connectEmulators() async {
    final host = emulatorHost;
    await FirebaseAuth.instance.useAuthEmulator(host, 9099);
    FirebaseFirestore.instance.useFirestoreEmulator(host, 8080);
    FirebaseFunctions.instanceFor(region: 'us-central1')
        .useFunctionsEmulator(host, 5001);
  }
}
