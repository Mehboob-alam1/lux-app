import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'firebase_bootstrap.dart';
import 'lux_logger.dart';

class AuthService {
  AuthService._();
  static final instance = AuthService._();

  final _auth = FirebaseAuth.instance;

  /// Web client ID from google-services.json (oauth_client type 3).
  /// Required so Google returns an idToken Firebase Auth can verify.
  static const _webClientId =
      '530001348279-flpsipirmki84u32ukbbhere6d87gdjl.apps.googleusercontent.com';

  final _google = GoogleSignIn(
    scopes: const ['email', 'profile'],
    serverClientId: _webClientId,
  );

  FirebaseFunctions get _fn =>
      FirebaseFunctions.instanceFor(region: 'us-central1');

  User? get currentUser => _auth.currentUser;
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  void _requireReady() {
    if (!FirebaseBootstrap.ready) {
      throw StateError(
        FirebaseBootstrap.initError ??
            'Firebase not ready. Check your connection and try again.',
      );
    }
  }

  String mapError(Object e) {
    if (e is PlatformException) {
      final details = '${e.code} ${e.message} ${e.details}'.toLowerCase();
      if (details.contains('apiexception: 10') ||
          details.contains('api_exception: 10') ||
          details.contains('sign_in_failed')) {
        return 'Google Sign-In config error (10). Rebuild the app after '
            'SHA-1 is added in Firebase for com.luxmobility.lux_driver.';
      }
      if (details.contains('network') || details.contains('7')) {
        return 'Network error during Google Sign-In. Check connection.';
      }
      return e.message ?? 'Google Sign-In failed (${e.code}).';
    }
    if (e is FirebaseAuthException) {
      switch (e.code) {
        case 'invalid-email':
          return 'Enter a valid email address.';
        case 'user-disabled':
          return 'This driver account has been disabled.';
        case 'user-not-found':
          return 'No driver account found for that email.';
        case 'wrong-password':
        case 'invalid-credential':
          return 'Incorrect email or password.';
        case 'email-already-in-use':
          return 'An account already exists for that email.';
        case 'weak-password':
          return 'Password must be at least 6 characters.';
        case 'too-many-requests':
          return 'Too many attempts. Try again later.';
        case 'network-request-failed':
          return 'Network error. Check your connection.';
        case 'expired-action-code':
          return 'This reset link has expired. Request a new one.';
        case 'invalid-action-code':
          return 'Invalid or used reset code.';
        case 'account-exists-with-different-credential':
          return 'An account already exists with a different sign-in method.';
        default:
          return e.message ?? 'Authentication failed (${e.code}).';
      }
    }
    return e.toString();
  }

  Future<User> signInWithEmail({
    required String email,
    required String password,
  }) async {
    _requireReady();
    return LuxLogger.timed('auth_email_sign_in', () async {
      final cred = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      final user = cred.user!;
      await _provision(
        displayName: user.displayName?.trim().isNotEmpty == true
            ? user.displayName!.trim()
            : 'Driver',
      );
      return user;
    });
  }

  Future<User> signUpWithEmail({
    required String email,
    required String password,
    required String displayName,
  }) async {
    _requireReady();
    return LuxLogger.timed('auth_email_sign_up', () async {
      final cred = await _auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      final user = cred.user!;
      final name = displayName.trim();
      if (name.isNotEmpty) {
        await user.updateDisplayName(name);
      }
      await _provision(displayName: name.isEmpty ? 'Driver' : name);
      await user.reload();
      return _auth.currentUser!;
    });
  }

  Future<User> signInWithGoogle() async {
    _requireReady();
    return LuxLogger.timed('auth_google_sign_in', () async {
      final account = await _google.signIn();
      if (account == null) {
        throw StateError('Google sign-in cancelled.');
      }
      final ga = await account.authentication;
      if (ga.idToken == null && ga.accessToken == null) {
        throw StateError(
          'Google sign-in is not fully configured. '
          'Enable Google in Firebase Auth and add your Android SHA-1.',
        );
      }
      final credential = GoogleAuthProvider.credential(
        accessToken: ga.accessToken,
        idToken: ga.idToken,
      );
      final cred = await _auth.signInWithCredential(credential);
      final user = cred.user!;
      await _provision(
        displayName: user.displayName?.trim().isNotEmpty == true
            ? user.displayName!.trim()
            : (account.displayName ?? 'Driver'),
      );
      return user;
    });
  }

  Future<void> sendPasswordResetEmail(String email) async {
    _requireReady();
    await _auth.sendPasswordResetEmail(email: email.trim());
  }

  Future<String> verifyPasswordResetCode(String code) async {
    _requireReady();
    return _auth.verifyPasswordResetCode(code.trim());
  }

  Future<void> confirmPasswordReset({
    required String code,
    required String newPassword,
  }) async {
    _requireReady();
    await _auth.confirmPasswordReset(
      code: code.trim(),
      newPassword: newPassword,
    );
  }

  Future<void> updateDisplayName(String name) async {
    final user = _auth.currentUser;
    if (user == null) throw StateError('Not signed in.');
    await user.updateDisplayName(name.trim());
    await user.reload();
  }

  /// Self-service profile via Cloud Function (client Firestore writes are denied).
  Future<void> updateMyProfile({
    String? displayName,
    String? phone,
  }) async {
    _requireReady();
    final user = _auth.currentUser;
    if (user == null) throw StateError('Not signed in.');
    return LuxLogger.timed('auth_update_profile', () async {
      await _fn.httpsCallable('updateMyProfile').call({
        if (displayName != null) 'displayName': displayName.trim(),
        if (phone != null) 'phone': phone.trim().isEmpty ? null : phone.trim(),
      });
      if (displayName != null && displayName.trim().isNotEmpty) {
        await user.reload();
      }
    });
  }

  Future<void> signOut() async {
    try {
      await _google.signOut();
    } catch (_) {}
    await _auth.signOut();
  }

  /// Call before driver callables — repairs sessions created before provisioning worked.
  Future<void> ensureProvisioned() async {
    _requireReady();
    final user = _auth.currentUser;
    if (user == null) throw StateError('Please sign in to continue.');
    final name = user.displayName?.trim().isNotEmpty == true
        ? user.displayName!.trim()
        : 'Driver';
    await _provision(displayName: name);
  }

  Future<void> _provision({required String displayName}) async {
    try {
      final res = await _fn.httpsCallable('provisionUser').call({
        'role': 'DRIVER',
        'displayName': displayName,
        'marketIds': ['yyz'],
        'consentVersions': {
          'tos': '2026-01-01',
          'driver_agreement': '2026-01-01',
        },
      });
      final data = Map<String, dynamic>.from(res.data as Map? ?? {});
      LuxLogger.info('user_provision', {
        'role': 'DRIVER',
        'already': data['alreadyProvisioned'] == true,
        'status': data['driverStatus']?.toString(),
      });
      await _auth.currentUser?.getIdToken(true);
    } on FirebaseFunctionsException catch (e) {
      LuxLogger.warn('user_provision_skip', {
        'code': e.code,
        'message': e.message,
      });
      if (e.code == 'unavailable' || e.code == 'not-found') return;
      rethrow;
    }
  }
}
