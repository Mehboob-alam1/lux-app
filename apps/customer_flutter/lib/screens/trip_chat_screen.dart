import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/booking_api.dart';
import '../services/push_notification_service.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_typography.dart';
import '../widgets/lux_chat_thread.dart';
import '../widgets/lux_feedback.dart';

class TripChatScreen extends StatefulWidget {
  const TripChatScreen({super.key, required this.bookingId});
  final String bookingId;

  @override
  State<TripChatScreen> createState() => _TripChatScreenState();
}

class _TripChatScreenState extends State<TripChatScreen> {
  @override
  void initState() {
    super.initState();
    PushNotificationService.setActiveChat(widget.bookingId);
  }

  @override
  void dispose() {
    PushNotificationService.setActiveChat(null);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Material(
              color: LuxColors.surface,
              elevation: 0.5,
              shadowColor: Colors.black12,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(4, 4, 16, 12),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => context.canPop()
                          ? context.pop()
                          : context.go('/trips/${widget.bookingId}'),
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: LuxColors.lime.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.directions_car_rounded),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Trip chat',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                            ),
                          ),
                          Text(
                            'Live with your chauffeur',
                            style:
                                LuxTypography.bodyMuted.copyWith(fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: LuxColors.successSoft,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.circle, size: 8, color: LuxColors.success),
                          SizedBox(width: 6),
                          Text(
                            'Live',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: LuxColors.success,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: StreamBuilder<List<Map<String, dynamic>>>(
                stream: BookingApi.instance.watchTripMessages(widget.bookingId),
                builder: (context, snap) {
                  if (snap.hasError) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'Could not load chat.\n${snap.error}',
                          textAlign: TextAlign.center,
                          style: LuxTypography.bodyMuted,
                        ),
                      ),
                    );
                  }
                  final messages = snap.data ?? const [];
                  return LuxChatThread(
                    messages: messages,
                    loading: snap.connectionState == ConnectionState.waiting &&
                        messages.isEmpty,
                    peerLabel: 'Driver',
                    emptyHint:
                        'Say hi — your chauffeur gets a push and can reply here.',
                    composerHint: 'Message your driver…',
                    onSend: (body) async {
                      try {
                        await BookingApi.instance.postTripMessage(
                          bookingId: widget.bookingId,
                          body: body,
                        );
                      } catch (e) {
                        if (context.mounted) {
                          LuxFeedback.error(
                            context,
                            e,
                            fallback: BookingApi.instance.mapError(e),
                          );
                        }
                        rethrow;
                      }
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
