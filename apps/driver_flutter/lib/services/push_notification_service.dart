import 'dart:async';
import 'dart:io' show Platform;

import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'firebase_bootstrap.dart';
import 'lux_logger.dart';

class PushPayload {
  const PushPayload({
    required this.title,
    required this.body,
    required this.route,
    this.bookingId,
    this.type,
  });

  final String title;
  final String body;
  final String route;
  final String? bookingId;
  final String? type;
}

/// FCM registration + deep-link routing into trip / support chat.
abstract final class PushNotificationService {
  static final _banner = StreamController<PushPayload>.broadcast();
  static Stream<PushPayload> get banners => _banner.stream;

  static GoRouter? _router;
  static String? _activeChatBookingId;
  static String? _token;
  static StreamSubscription<User?>? _authSub;
  static bool _wired = false;
  static const appId = 'driver';

  static void setActiveChat(String? bookingId) {
    _activeChatBookingId = bookingId;
  }

  static void attachRouter(GoRouter router) {
    _router = router;
  }

  static Future<void> init() async {
    if (_wired || kIsWeb) return;
    if (!FirebaseBootstrap.ready) return;
    _wired = true;

    final messaging = FirebaseMessaging.instance;
    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    LuxLogger.info('push_permission', {
      'status': settings.authorizationStatus.name,
    });

    FirebaseMessaging.onMessage.listen(_onForeground);
    FirebaseMessaging.onMessageOpenedApp.listen(_onOpened);
    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      // Delay until router/shell is ready.
      Future<void>.delayed(const Duration(milliseconds: 700), () {
        _onOpened(initial);
      });
    }

    // Prefer FID registration (firebase_messaging 17+); fall back to legacy token.
    messaging.onRegistered.listen((fid) {
      _token = fid;
      unawaited(_register(fid));
    });
    // ignore: deprecated_member_use
    messaging.onTokenRefresh.listen((t) {
      _token = t;
      unawaited(_register(t));
    });

    _authSub?.cancel();
    _authSub = FirebaseAuth.instance.authStateChanges().listen((user) async {
      if (user == null) {
        await _deactivate();
        return;
      }
      try {
        if (defaultTargetPlatform == TargetPlatform.iOS) {
          for (var i = 0; i < 5; i++) {
            final apns = await messaging.getAPNSToken();
            if (apns != null) break;
            await Future<void>.delayed(const Duration(seconds: 1));
          }
        }
        try {
          await messaging.register();
        } catch (_) {
          // Legacy path when FID registration is not enabled.
          // ignore: deprecated_member_use
          final t = await messaging.getToken();
          if (t != null) {
            _token = t;
            await _register(t);
          }
        }
      } catch (e, st) {
        LuxLogger.error('push_token_failed', const {}, e, st);
      }
    });
  }

  static Future<void> _register(String token) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    try {
      final platform = !kIsWeb && Platform.isIOS
          ? 'ios'
          : !kIsWeb && Platform.isAndroid
              ? 'android'
              : 'unknown';
      await FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('registerDeviceToken')
          .call({
        'token': token,
        'platform': platform,
        'app': appId,
        'active': true,
      });
      LuxLogger.info('push_token_registered', {'app': appId});
    } catch (e, st) {
      LuxLogger.error('push_register_failed', const {}, e, st);
    }
  }

  static Future<void> _deactivate() async {
    final token = _token;
    if (token == null) return;
    try {
      await FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('registerDeviceToken')
          .call({
        'token': token,
        'platform': 'unknown',
        'app': appId,
        'active': false,
      });
    } catch (_) {}
    _token = null;
  }

  static PushPayload? _payloadFrom(RemoteMessage message) {
    final data = message.data;
    final type = data['type'];
    final bookingId = data['bookingId'];
    var route = data['route'];
    if ((route == null || route.isEmpty) &&
        bookingId != null &&
        bookingId.isNotEmpty) {
      route = type == 'trip_message'
          ? '/active-trip/$bookingId/chat'
          : '/active-trip/$bookingId';
    }
    if (route == null || route.isEmpty) return null;
    return PushPayload(
      title: message.notification?.title ??
          (type == 'trip_message' ? 'New trip message' : 'LUX'),
      body: message.notification?.body ?? data['body'] ?? '',
      route: route,
      bookingId: bookingId,
      type: type,
    );
  }

  static void _onForeground(RemoteMessage message) {
    final payload = _payloadFrom(message);
    if (payload == null) return;
    if (payload.bookingId != null &&
        payload.bookingId == _activeChatBookingId) {
      // Already viewing this chat — skip banner noise.
      return;
    }
    _banner.add(payload);
  }

  static void _onOpened(RemoteMessage message) {
    final payload = _payloadFrom(message);
    if (payload == null) return;
    openRoute(payload.route);
  }

  static void openRoute(String route) {
    final router = _router;
    if (router == null) return;
    try {
      router.go(route);
    } catch (e, st) {
      LuxLogger.error('push_nav_failed', {'route': route}, e, st);
    }
  }

  static void dispose() {
    _authSub?.cancel();
    _authSub = null;
  }
}

/// Soft in-app banner for foreground trip chat pushes.
class LuxPushBannerHost extends StatefulWidget {
  const LuxPushBannerHost({super.key, required this.child});
  final Widget child;

  @override
  State<LuxPushBannerHost> createState() => _LuxPushBannerHostState();
}

class _LuxPushBannerHostState extends State<LuxPushBannerHost>
    with SingleTickerProviderStateMixin {
  PushPayload? _current;
  StreamSubscription<PushPayload>? _sub;
  late final AnimationController _anim;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _sub = PushNotificationService.banners.listen((p) async {
      setState(() => _current = p);
      await _anim.forward(from: 0);
      await Future<void>.delayed(const Duration(seconds: 4));
      if (mounted && _current == p) {
        await _anim.reverse();
        if (mounted) setState(() => _current = null);
      }
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (_current != null)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0, -1.2),
                  end: Offset.zero,
                ).animate(CurvedAnimation(
                  parent: _anim,
                  curve: Curves.easeOutCubic,
                )),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Material(
                    elevation: 8,
                    borderRadius: BorderRadius.circular(18),
                    color: const Color(0xFF111813),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(18),
                      onTap: () {
                        final route = _current!.route;
                        setState(() => _current = null);
                        PushNotificationService.openRoute(route);
                      },
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: const Color(0xFFC7F36B),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                Icons.chat_bubble_rounded,
                                color: Color(0xFF111813),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _current!.title,
                                    style: const TextStyle(
                                      color: Color(0xFFC7F36B),
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _current!.body,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                      height: 1.3,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(
                              Icons.chevron_right_rounded,
                              color: Colors.white70,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
