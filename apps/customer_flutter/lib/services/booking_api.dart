import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'firebase_bootstrap.dart';

class QuoteResult {
  QuoteResult(this.raw);
  final Map<String, dynamic> raw;
  Map<String, dynamic> get quote =>
      Map<String, dynamic>.from(raw['quote'] as Map? ?? raw);
  int get totalMinor => (quote['totalMinor'] as num?)?.toInt() ?? 0;
  String get currency => quote['currency'] as String? ?? 'CAD';
  String get quoteId =>
      quote['quoteId'] as String? ?? raw['quoteId'] as String? ?? '';
  String get priceKind => quote['priceKind'] as String? ?? 'FIXED';
  String? get notice => raw['paymentMode'] == 'sandbox'
      ? 'Sandbox pricing — no live charge'
      : null;
}

/// Thin API facade. Mutations go through Cloud Functions (docs/API_CONTRACTS.md).
class BookingApi {
  BookingApi._();
  static final instance = BookingApi._();

  FirebaseFunctions get _fn =>
      FirebaseFunctions.instanceFor(region: 'us-central1');
  FirebaseFirestore get _db => FirebaseFirestore.instance;
  FirebaseAuth get _auth => FirebaseAuth.instance;

  String _idem(String prefix) =>
      '${prefix}_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(9999)}';

  void _requireReady() {
    if (!FirebaseBootstrap.ready) {
      throw StateError(
        FirebaseBootstrap.initError ??
            'Firebase not ready. Start emulators (npm run emulators) and seed.',
      );
    }
  }

  Future<User> ensureSignedIn({
    String email = 'customer@lux.test',
    String password = 'LuxTest123!',
  }) async {
    _requireReady();
    final existing = _auth.currentUser;
    if (existing != null) return existing;
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
        'role': 'CUSTOMER',
        'displayName': 'Casey Customer',
        'marketIds': ['yyz'],
        'consentVersions': {'tos': '2026-01-01'},
      });
      return cred.user!;
    }
  }

  Future<void> signOut() => _auth.signOut();

  Future<QuoteResult> createQuote({
    required int passengers,
    required int luggage,
    required String classId,
    required Map<String, dynamic> pickup,
    required Map<String, dynamic> dropoff,
    String marketId = 'yyz',
    String tripContext = 'STANDARD',
    List<String> addons = const [],
    Map<String, dynamic>? airport,
    DateTime? scheduledAt,
  }) async {
    final user = await ensureSignedIn();
    final res = await _fn.httpsCallable('createQuote').call({
      'idempotencyKey': _idem('quote'),
      'marketId': marketId,
      'customerUid': user.uid,
      'passengers': passengers,
      'luggage': luggage,
      'selectedClass': classId,
      'tripContext': tripContext,
      'addons': addons,
      if (airport != null) 'airport': airport,
      if (scheduledAt != null)
        'scheduledAt': scheduledAt.toUtc().toIso8601String(),
      'itinerary': [
        {
          'sequence': 0,
          'kind': 'PICKUP',
          'place': pickup,
        },
        {
          'sequence': 1,
          'kind': 'DROPOFF',
          'place': dropoff,
        },
      ],
    });
    return QuoteResult(Map<String, dynamic>.from(res.data as Map));
  }

  Future<Map<String, dynamic>> authorizeAndConfirm({
    required String quoteId,
    String paymentMethodToken = 'tok_ok',
  }) async {
    final user = await ensureSignedIn();
    const marketId = 'yyz';
    final pay = await _fn.httpsCallable('authorizePayment').call({
      'idempotencyKey': _idem('pay'),
      'marketId': marketId,
      'quoteId': quoteId,
      'paymentMethodToken': paymentMethodToken,
    });
    final payment = Map<String, dynamic>.from(
      (pay.data as Map)['payment'] as Map? ?? pay.data as Map,
    );
    final paymentId = payment['paymentId'] as String? ??
        (pay.data as Map)['paymentId'] as String?;
    if (paymentId == null) {
      throw StateError('authorizePayment returned no paymentId: ${pay.data}');
    }
    final conf = await _fn.httpsCallable('confirmBooking').call({
      'idempotencyKey': _idem('book'),
      'marketId': marketId,
      'quoteId': quoteId,
      'paymentId': paymentId,
      'bookerUid': user.uid,
    });
    return Map<String, dynamic>.from(conf.data as Map);
  }

  Stream<List<Map<String, dynamic>>> watchMyBookings() {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return Stream.value(const []);
    return _db
        .collection('bookings')
        .where('customerUid', isEqualTo: uid)
        .snapshots()
        .map((snap) {
      final rows = snap.docs.map((d) {
        final data = Map<String, dynamic>.from(d.data());
        data['bookingId'] ??= d.id;
        return data;
      }).toList();
      rows.sort((a, b) {
        final aa = a['updatedAt'] as String? ?? a['createdAt'] as String? ?? '';
        final bb = b['updatedAt'] as String? ?? b['createdAt'] as String? ?? '';
        return bb.compareTo(aa);
      });
      return rows;
    });
  }

  Future<Map<String, dynamic>?> getBooking(String bookingId) async {
    final doc = await _db.collection('bookings').doc(bookingId).get();
    if (!doc.exists) return null;
    final data = Map<String, dynamic>.from(doc.data()!);
    data['bookingId'] ??= doc.id;
    return data;
  }

  Future<Map<String, dynamic>> openSupport({
    required String subject,
    required String message,
    String? bookingId,
    bool escalateSafety = false,
  }) async {
    await ensureSignedIn();
    final res = await _fn.httpsCallable('createSupportCase').call({
      'idempotencyKey': _idem('sup'),
      if (bookingId != null) 'bookingId': bookingId,
      'category': escalateSafety ? 'SAFETY' : 'HELP',
      'subject': subject,
      'message': message,
      'escalateSafety': escalateSafety,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Stream<List<Map<String, dynamic>>> watchMySupportCases() {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return Stream.value(const []);
    return _db
        .collection('support_cases')
        .where('ownerUid', isEqualTo: uid)
        .snapshots()
        .map((snap) => snap.docs.map((d) {
              final data = Map<String, dynamic>.from(d.data());
              data['id'] ??= d.id;
              return data;
            }).toList());
  }
}
