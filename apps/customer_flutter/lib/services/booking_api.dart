import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'firebase_bootstrap.dart';
import 'lux_logger.dart';

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

  String mapError(Object e) {
    if (e is FirebaseFunctionsException) {
      final details = e.details;
      if (details is Map && details['reasons'] is List) {
        return (details['reasons'] as List).join('; ');
      }
      return e.message?.isNotEmpty == true
          ? e.message!
          : 'Request failed (${e.code})';
    }
    return e.toString();
  }

  Future<User> ensureSignedIn() async {
    _requireReady();
    final existing = _auth.currentUser;
    if (existing != null) return existing;
    throw StateError('Please sign in to continue.');
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
    return LuxLogger.timed('create_quote', () async {
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
      final result = QuoteResult(Map<String, dynamic>.from(res.data as Map));
      LuxLogger.info('quote_ready', {
        'quoteId': result.quoteId,
        'totalMinor': result.totalMinor,
        'classId': classId,
      });
      return result;
    }, fields: {'classId': classId, 'marketId': marketId});
  }

  Future<Map<String, dynamic>> authorizeAndConfirm({
    required String quoteId,
    String paymentMethodToken = 'tok_ok',
  }) async {
    final user = await ensureSignedIn();
    const marketId = 'yyz';
    return LuxLogger.timed('authorize_and_confirm', () async {
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
      LuxLogger.info('payment_authorized', {
        'quoteId': quoteId,
        'paymentId': paymentId,
      });
      final conf = await _fn.httpsCallable('confirmBooking').call({
        'idempotencyKey': _idem('book'),
        'marketId': marketId,
        'quoteId': quoteId,
        'paymentId': paymentId,
        'bookerUid': user.uid,
      });
      final out = Map<String, dynamic>.from(conf.data as Map);
      LuxLogger.info('booking_confirmed', {
        'quoteId': quoteId,
        'bookingId': out['bookingId']?.toString(),
      });
      return out;
    }, fields: {'quoteId': quoteId});
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

  Stream<Map<String, dynamic>?> watchBooking(String bookingId) {
    return _db.collection('bookings').doc(bookingId).snapshots().map((doc) {
      if (!doc.exists) return null;
      final data = Map<String, dynamic>.from(doc.data()!);
      data['bookingId'] ??= doc.id;
      return data;
    });
  }

  Future<Map<String, dynamic>> openSupport({
    required String subject,
    required String message,
    String? bookingId,
    bool escalateSafety = false,
  }) async {
    await ensureSignedIn();
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
            final aa = a['updatedAt']?.toString() ?? a['lastMessageAt']?.toString() ?? '';
            final bb = b['updatedAt']?.toString() ?? b['lastMessageAt']?.toString() ?? '';
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
    await ensureSignedIn();
    await _fn.httpsCallable('postSupportMessage').call({
      'caseId': caseId,
      'body': body,
    });
  }

  Stream<List<Map<String, dynamic>>> watchTripMessages(String bookingId) {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return Stream.value(const []);
    // Query must constrain customerUid so it matches Firestore security rules.
    return _db
        .collection('trip_messages')
        .where('bookingId', isEqualTo: bookingId)
        .where('customerUid', isEqualTo: uid)
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
    await ensureSignedIn();
    await _fn.httpsCallable('postTripMessage').call({
      'bookingId': bookingId,
      'body': body,
    });
  }
}
