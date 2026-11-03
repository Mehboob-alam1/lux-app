import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'firebase_bootstrap.dart';

class DriverApi {
  DriverApi._();
  static final instance = DriverApi._();

  FirebaseFunctions get _fn =>
      FirebaseFunctions.instanceFor(region: 'us-central1');
  FirebaseFirestore get _db => FirebaseFirestore.instance;
  FirebaseAuth get _auth => FirebaseAuth.instance;

  String _idem(String p) =>
      '${p}_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(9999)}';

  void _requireReady() {
    if (!FirebaseBootstrap.ready) {
      throw StateError(FirebaseBootstrap.initError ?? 'Firebase not ready');
    }
  }

  Future<User> ensureSignedIn({
    String email = 'driver@lux.test',
    String password = 'LuxTest123!',
  }) async {
    _requireReady();
    if (_auth.currentUser != null) return _auth.currentUser!;
    try {
      final cred = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      return cred.user!;
    } on FirebaseAuthException {
      final cred = await _auth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );
      await _fn.httpsCallable('provisionUser').call({
        'role': 'DRIVER',
        'displayName': 'Alex Driver',
        'marketIds': ['yyz'],
      });
      return cred.user!;
    }
  }

  Future<Map<String, dynamic>> setOnline(bool online) async {
    await ensureSignedIn();
    final res = await _fn.httpsCallable('setDriverOnline').call({
      'online': online,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Stream<QuerySnapshot<Map<String, dynamic>>> offersStream() {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return const Stream.empty();
    return _db
        .collection('driver_offers')
        .where('driverId', isEqualTo: uid)
        .where('response', isEqualTo: 'PENDING')
        .snapshots();
  }

  Future<Map<String, dynamic>?> myVehicle() async {
    final uid = (await ensureSignedIn()).uid;
    final q = await _db
        .collection('vehicles')
        .where('ownerDriverId', isEqualTo: uid)
        .limit(1)
        .get();
    if (q.docs.isEmpty) return null;
    final data = Map<String, dynamic>.from(q.docs.first.data());
    data['vehicleId'] ??= q.docs.first.id;
    return data;
  }

  Future<Map<String, dynamic>> acceptOffer({
    required String offerId,
    required String vehicleId,
  }) async {
    await ensureSignedIn();
    final res = await _fn.httpsCallable('acceptOffer').call({
      'idempotencyKey': _idem('accept'),
      'marketId': 'yyz',
      'offerId': offerId,
      'vehicleId': vehicleId,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> tripAction({
    required String bookingId,
    required String action,
    int? expectedStatusVersion,
    Map<String, dynamic>? location,
  }) async {
    await ensureSignedIn();
    await _fn.httpsCallable('tripLifecycle').call({
      'idempotencyKey': _idem('trip_$action'),
      'marketId': 'yyz',
      'bookingId': bookingId,
      'action': action,
      if (expectedStatusVersion != null)
        'expectedStatusVersion': expectedStatusVersion,
      if (location != null) 'location': location,
    });
  }

  Stream<List<Map<String, dynamic>>> watchAssignedBookings() {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return Stream.value(const []);
    return _db
        .collection('bookings')
        .where('assignedDriverId', isEqualTo: uid)
        .snapshots()
        .map((snap) => snap.docs.map((d) {
              final data = Map<String, dynamic>.from(d.data());
              data['bookingId'] ??= d.id;
              return data;
            }).toList());
  }

  Future<void> signOut() => _auth.signOut();
}
