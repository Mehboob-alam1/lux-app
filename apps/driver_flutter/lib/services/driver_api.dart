import 'dart:io';
import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';

import 'auth_service.dart';
import 'firebase_bootstrap.dart';
import 'lux_logger.dart';

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

  String mapError(Object e) {
    if (e is FirebaseFunctionsException) {
      final details = e.details;
      if (details is Map && details['reasons'] is List) {
        return (details['reasons'] as List).join('; ');
      }
      if (e.code == 'failed-precondition' &&
          (e.message ?? '').contains('not provisioned')) {
        return 'Driver profile missing. Sign out and sign in again, then retry.';
      }
      return e.message?.isNotEmpty == true
          ? e.message!
          : 'Request failed (${e.code})';
    }
    return e.toString();
  }

  Future<User> ensureSignedIn() async {
    _requireReady();
    final user = _auth.currentUser;
    if (user != null) return user;
    throw StateError('Please sign in to continue.');
  }

  Future<void> _ensureReadyForCallables() async {
    await ensureSignedIn();
    await AuthService.instance.ensureProvisioned();
  }

  Future<Map<String, dynamic>> setOnline(bool online) async {
    await _ensureReadyForCallables();
    return LuxLogger.timed('set_driver_online', () async {
      final res = await _fn.httpsCallable('setDriverOnline').call({
        'online': online,
      });
      final out = Map<String, dynamic>.from(res.data as Map);
      LuxLogger.info('driver_online_state', {
        'online': online,
        'state': out['onlineState']?.toString(),
      });
      return out;
    }, fields: {'online': online});
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
    await _ensureReadyForCallables();
    return LuxLogger.timed('accept_offer', () async {
      final res = await _fn.httpsCallable('acceptOffer').call({
        'idempotencyKey': _idem('accept'),
        'marketId': 'yyz',
        'offerId': offerId,
        'vehicleId': vehicleId,
      });
      return Map<String, dynamic>.from(res.data as Map);
    }, fields: {'offerId': offerId, 'vehicleId': vehicleId});
  }

  Future<void> tripAction({
    required String bookingId,
    required String action,
    int? expectedStatusVersion,
    Map<String, dynamic>? location,
  }) async {
    await _ensureReadyForCallables();
    await LuxLogger.timed('trip_lifecycle', () async {
      await _fn.httpsCallable('tripLifecycle').call({
        'idempotencyKey': _idem('trip_$action'),
        'marketId': 'yyz',
        'bookingId': bookingId,
        'action': action,
        if (expectedStatusVersion != null)
          'expectedStatusVersion': expectedStatusVersion,
        if (location != null) 'location': location,
      });
    }, fields: {'bookingId': bookingId, 'action': action});
  }

  Future<void> updateLocation({
    required double lat,
    required double lng,
    String? bookingId,
  }) async {
    await _ensureReadyForCallables();
    await LuxLogger.timed('update_driver_location', () async {
      await _fn.httpsCallable('updateDriverLocation').call({
        'lat': lat,
        'lng': lng,
        if (bookingId != null) 'bookingId': bookingId,
      });
    }, fields: {'bookingId': bookingId});
  }

  Future<void> cancelAssignment({
    required String bookingId,
    required String assignmentId,
    required String reason,
    String kind = 'SOFT',
  }) async {
    await _ensureReadyForCallables();
    await LuxLogger.timed('driver_cancel', () async {
      await _fn.httpsCallable('driverCancelAssignment').call({
        'idempotencyKey': _idem('cancel'),
        'marketId': 'yyz',
        'bookingId': bookingId,
        'assignmentId': assignmentId,
        'reason': reason,
        'kind': kind,
      });
    }, fields: {'bookingId': bookingId, 'kind': kind});
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

  Stream<Map<String, dynamic>?> watchMyDriver() {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return Stream.value(null);
    return _db.collection('drivers').doc(uid).snapshots().map((doc) {
      if (!doc.exists) return null;
      final data = Map<String, dynamic>.from(doc.data()!);
      data['uid'] ??= doc.id;
      return data;
    });
  }

  Stream<Map<String, dynamic>?> watchBooking(String bookingId) {
    return _db.collection('bookings').doc(bookingId).snapshots().map((doc) {
      if (!doc.exists) return null;
      final data = Map<String, dynamic>.from(doc.data()!);
      data['bookingId'] ??= doc.id;
      return data;
    });
  }

  /// Upload a file to Storage, then mark the checklist row SUBMITTED via CF.
  Future<Map<String, dynamic>> submitDocumentFile({
    required String documentId,
    required File file,
    required String contentType,
    String? fileName,
  }) async {
    await _ensureReadyForCallables();
    final uid = _auth.currentUser!.uid;
    final ext = () {
      final name = fileName ?? file.path.split(Platform.pathSeparator).last;
      final dot = name.lastIndexOf('.');
      if (dot >= 0 && dot < name.length - 1) {
        return name.substring(dot + 1).toLowerCase();
      }
      if (contentType == 'application/pdf') return 'pdf';
      if (contentType == 'image/png') return 'png';
      if (contentType == 'image/webp') return 'webp';
      return 'jpg';
    }();
    final storagePath =
        'driver_documents/$uid/${documentId}_${DateTime.now().millisecondsSinceEpoch}.$ext';

    return LuxLogger.timed('submit_driver_document', () async {
      final ref = FirebaseStorage.instance.ref(storagePath);
      await ref.putFile(
        file,
        SettableMetadata(contentType: contentType),
      );
      final res = await _fn.httpsCallable('submitDriverDocument').call({
        'documentId': documentId,
        'storagePath': storagePath,
        'contentType': contentType,
        'fileName': fileName ?? file.path.split(Platform.pathSeparator).last,
      });
      return Map<String, dynamic>.from(res.data as Map);
    }, fields: {'documentId': documentId});
  }

  Stream<List<Map<String, dynamic>>> watchTripMessages(String bookingId) {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return Stream.value(const []);
    // Query must constrain driverId so it matches Firestore security rules.
    return _db
        .collection('trip_messages')
        .where('bookingId', isEqualTo: bookingId)
        .where('driverId', isEqualTo: uid)
        .orderBy('createdAt')
        .snapshots()
        .map((snap) {
          return snap.docs.map((d) {
            final data = Map<String, dynamic>.from(d.data());
            data['messageId'] ??= d.id;
            return data;
          }).toList();
        });
  }

  Future<void> postTripMessage({
    required String bookingId,
    required String body,
  }) async {
    await _ensureReadyForCallables();
    await _fn.httpsCallable('postTripMessage').call({
      'bookingId': bookingId,
      'body': body,
    });
  }

  Future<Map<String, dynamic>> openSupport({
    required String subject,
    required String message,
    String? bookingId,
    bool escalateSafety = false,
  }) async {
    await _ensureReadyForCallables();
    return LuxLogger.timed('open_support', () async {
      final res = await _fn.httpsCallable('createSupportCase').call({
        'idempotencyKey': _idem('sup'),
        if (bookingId != null) 'bookingId': bookingId,
        'category': escalateSafety ? 'SAFETY' : 'HELP',
        'subject': subject,
        'message': message,
        'escalateSafety': escalateSafety,
      });
      return Map<String, dynamic>.from(res.data as Map);
    }, fields: {'escalateSafety': escalateSafety});
  }

  Stream<List<Map<String, dynamic>>> watchMySupportCases() {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return Stream.value(const []);
    return _db
        .collection('support_cases')
        .where('ownerUid', isEqualTo: uid)
        .snapshots()
        .map((snap) {
          final rows = snap.docs.map((d) {
            final data = Map<String, dynamic>.from(d.data());
            data['id'] ??= d.id;
            data['caseId'] ??= d.id;
            return data;
          }).toList();
          rows.sort((a, b) {
            final aa =
                a['updatedAt']?.toString() ?? a['lastMessageAt']?.toString() ?? '';
            final bb =
                b['updatedAt']?.toString() ?? b['lastMessageAt']?.toString() ?? '';
            return bb.compareTo(aa);
          });
          return rows;
        });
  }

  Stream<Map<String, dynamic>?> watchSupportCase(String caseId) {
    return _db.collection('support_cases').doc(caseId).snapshots().map((doc) {
      if (!doc.exists) return null;
      final data = Map<String, dynamic>.from(doc.data()!);
      data['caseId'] ??= doc.id;
      data['id'] ??= doc.id;
      return data;
    });
  }

  Stream<List<Map<String, dynamic>>> watchSupportMessages(String caseId) {
    return _db
        .collection('support_messages')
        .where('caseId', isEqualTo: caseId)
        .snapshots()
        .map((snap) {
          final rows = snap.docs
              .map((d) {
                final data = Map<String, dynamic>.from(d.data());
                data['messageId'] ??= d.id;
                return data;
              })
              .where((m) => m['visibility'] != 'INTERNAL')
              .toList();
          rows.sort((a, b) {
            final aa = a['createdAt']?.toString() ?? '';
            final bb = b['createdAt']?.toString() ?? '';
            return aa.compareTo(bb);
          });
          return rows;
        });
  }

  Future<void> postSupportMessage({
    required String caseId,
    required String body,
  }) async {
    await _ensureReadyForCallables();
    await _fn.httpsCallable('postSupportMessage').call({
      'caseId': caseId,
      'body': body,
    });
  }

  Future<void> signOut() => _auth.signOut();
}
