import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/driver_api.dart';
import '../../theme/lux_colors.dart';
import '../../theme/lux_typography.dart';
import '../../widgets/lux_chat_thread.dart';
import '../../widgets/lux_feedback.dart';

class SupportCaseChatScreen extends StatelessWidget {
  const SupportCaseChatScreen({super.key, required this.caseId});
  final String caseId;

  Color _statusColor(String status) {
    switch (status) {
      case 'OPEN':
      case 'REOPENED':
        return LuxColors.info;
      case 'PENDING_CUSTOMER':
        return LuxColors.warning;
      case 'PENDING_INTERNAL':
        return LuxColors.info;
      case 'RESOLVED':
        return LuxColors.success;
      case 'CLOSED':
        return LuxColors.muted;
      default:
        return LuxColors.muted;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'PENDING_CUSTOMER':
        return 'Awaiting you';
      case 'PENDING_INTERNAL':
        return 'Ops reviewing';
      case 'RESOLVED':
        return 'Resolved';
      case 'CLOSED':
        return 'Closed';
      case 'REOPENED':
        return 'Reopened';
      default:
        return status.isEmpty ? 'Open' : status;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: StreamBuilder<Map<String, dynamic>?>(
          stream: DriverApi.instance.watchSupportCase(caseId),
          builder: (context, caseSnap) {
            final c = caseSnap.data;
            final subject = c?['subject']?.toString() ?? 'Support chat';
            final status = (c?['status']?.toString() ?? 'OPEN').toUpperCase();
            final closed = status == 'CLOSED';
            final category = c?['category']?.toString() ?? 'HELP';
            final preview = c?['lastMessagePreview']?.toString();

            return Column(
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
                              : context.go('/help-safety'),
                          icon: const Icon(Icons.arrow_back_rounded),
                        ),
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: LuxColors.lime.withValues(alpha: 0.55),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.support_agent_rounded,
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                subject,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 16,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                closed
                                    ? 'This case is closed'
                                    : (preview?.isNotEmpty == true
                                        ? preview!
                                        : 'Chat with LUX ops'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: LuxTypography.bodyMuted
                                    .copyWith(fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: _statusColor(status)
                                    .withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(99),
                                border: Border.all(
                                  color: _statusColor(status)
                                      .withValues(alpha: 0.35),
                                ),
                              ),
                              child: Text(
                                _statusLabel(status),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: _statusColor(status),
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              category,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: LuxColors.mutedSoft,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: StreamBuilder<List<Map<String, dynamic>>>(
                    stream: DriverApi.instance.watchSupportMessages(caseId),
                    builder: (context, snap) {
                      if (snap.hasError) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              'Could not load messages.\n${snap.error}',
                              textAlign: TextAlign.center,
                              style: LuxTypography.bodyMuted,
                            ),
                          ),
                        );
                      }
                      final messages = snap.data ?? const [];
                      return LuxChatThread(
                        messages: messages,
                        busy: closed,
                        peerLabel: 'LUX Ops',
                        emptyHint: closed
                            ? 'No messages on this case.'
                            : 'Describe what you need — ops replies here in real time.',
                        composerHint: closed
                            ? 'Case closed'
                            : 'Message LUX support…',
                        onSend: (body) async {
                          try {
                            await DriverApi.instance.postSupportMessage(
                              caseId: caseId,
                              body: body,
                            );
                          } catch (e) {
                            if (context.mounted) {
                              LuxFeedback.error(
                                context,
                                e,
                                fallback: DriverApi.instance.mapError(e),
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
            );
          },
        ),
      ),
    );
  }
}
