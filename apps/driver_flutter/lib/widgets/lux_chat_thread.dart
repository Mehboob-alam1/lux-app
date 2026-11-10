import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/lux_colors.dart';
import '../theme/lux_typography.dart';

class LuxChatThread extends StatefulWidget {
  const LuxChatThread({
    super.key,
    required this.messages,
    required this.onSend,
    this.busy = false,
    this.loading = false,
    this.emptyHint = 'No messages yet. Say hello.',
    this.composerHint = 'Type a message…',
    this.peerLabel = 'Them',
  });

  final List<Map<String, dynamic>> messages;
  final Future<void> Function(String body) onSend;
  final bool busy;
  final bool loading;
  final String emptyHint;
  final String composerHint;
  final String peerLabel;

  @override
  State<LuxChatThread> createState() => _LuxChatThreadState();
}

class _LuxChatThreadState extends State<LuxChatThread> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  final _scroll = ScrollController();
  bool _sending = false;
  final List<Map<String, dynamic>> _pending = [];

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant LuxChatThread oldWidget) {
    super.didUpdateWidget(oldWidget);
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (widget.messages.length != oldWidget.messages.length) {
      _pending.removeWhere((p) {
        final body = p['body']?.toString();
        return widget.messages.any(
          (m) => m['authorUid'] == uid && m['body']?.toString() == body,
        );
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _jumpToEnd());
    }
  }

  List<Map<String, dynamic>> get _allMessages => [
        ...widget.messages,
        ..._pending,
      ];

  void _jumpToEnd() {
    if (!_scroll.hasClients) return;
    _scroll.animateTo(
      _scroll.position.maxScrollExtent + 140,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending || widget.busy) return;
    final uid = FirebaseAuth.instance.currentUser?.uid;
    final optimistic = <String, dynamic>{
      'messageId': 'local_${DateTime.now().microsecondsSinceEpoch}',
      'authorUid': uid,
      'authorRole': 'CUSTOMER',
      'body': text,
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      '_pending': true,
    };
    setState(() {
      _sending = true;
      _pending.add(optimistic);
      _controller.clear();
    });
    HapticFeedback.selectionClick();
    WidgetsBinding.instance.addPostFrameCallback((_) => _jumpToEnd());
    try {
      await widget.onSend(text);
      _focus.requestFocus();
    } catch (_) {
      setState(() {
        _pending.removeWhere((m) => m['messageId'] == optimistic['messageId']);
      });
      rethrow;
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  String _roleLabel(Map<String, dynamic> m, bool mine) {
    if (mine) return m['_pending'] == true ? 'You · sending' : 'You';
    final role = (m['authorRole'] as String?) ?? '';
    switch (role) {
      case 'ADMIN':
        return 'LUX Ops';
      case 'DRIVER':
        return 'Driver';
      case 'CUSTOMER':
        return 'Customer';
      default:
        return widget.peerLabel;
    }
  }

  String _timeLabel(dynamic raw) {
    if (raw == null) return '';
    final d = DateTime.tryParse(raw.toString());
    if (d == null) return '';
    final local = d.toLocal();
    final now = DateTime.now();
    final sameDay = local.year == now.year &&
        local.month == now.month &&
        local.day == now.day;
    final hm =
        '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
    if (sameDay) return hm;
    return '${local.day}/${local.month} $hm';
  }

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    final messages = _allMessages;

    return Column(
      children: [
        Expanded(
          child: DecoratedBox(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFFF3F6EF),
                  LuxColors.background,
                ],
              ),
            ),
            child: widget.loading && widget.messages.isEmpty
                ? const Center(
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  )
                : messages.isEmpty
                    ? _EmptyChat(hint: widget.emptyHint)
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
                        itemCount: messages.length,
                        itemBuilder: (context, i) {
                          final m = messages[i];
                          final mine = m['authorUid'] == uid;
                          final showDay = i == 0 ||
                              _dayKey(messages[i - 1]['createdAt']) !=
                                  _dayKey(m['createdAt']);
                          return Column(
                            children: [
                              if (showDay)
                                _DayChip(label: _dayLabel(m['createdAt'])),
                              _Bubble(
                                mine: mine,
                                pending: m['_pending'] == true,
                                label: _roleLabel(m, mine),
                                body: m['body']?.toString() ?? '',
                                time: _timeLabel(m['createdAt']),
                              ),
                            ],
                          );
                        },
                      ),
          ),
        ),
        Material(
          color: LuxColors.surface,
          elevation: 10,
          shadowColor: Colors.black26,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: LuxColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: LuxColors.line),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: TextField(
                        controller: _controller,
                        focusNode: _focus,
                        minLines: 1,
                        maxLines: 5,
                        textInputAction: TextInputAction.send,
                        enabled: !_sending && !widget.busy,
                        onSubmitted: (_) => _send(),
                        onChanged: (_) => setState(() {}),
                        decoration: InputDecoration(
                          hintText: widget.composerHint,
                          hintStyle: LuxTypography.bodyMuted,
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _SendButton(
                    enabled: !_sending &&
                        !widget.busy &&
                        _controller.text.trim().isNotEmpty,
                    loading: _sending,
                    onPressed: _send,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  String _dayKey(dynamic raw) {
    final d = DateTime.tryParse(raw?.toString() ?? '');
    if (d == null) return '';
    final l = d.toLocal();
    return '${l.year}-${l.month}-${l.day}';
  }

  String _dayLabel(dynamic raw) {
    final d = DateTime.tryParse(raw?.toString() ?? '');
    if (d == null) return 'Messages';
    final l = d.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(l.year, l.month, l.day);
    if (day == today) return 'Today';
    if (day == today.subtract(const Duration(days: 1))) return 'Yesterday';
    return '${l.day}/${l.month}/${l.year}';
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({
    required this.enabled,
    required this.loading,
    required this.onPressed,
  });

  final bool enabled;
  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: enabled ? LuxColors.ink : LuxColors.disabledBg,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: enabled && !loading ? onPressed : null,
        child: SizedBox(
          width: 48,
          height: 48,
          child: Center(
            child: loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: LuxColors.lime,
                    ),
                  )
                : Icon(
                    Icons.send_rounded,
                    color: enabled ? LuxColors.lime : LuxColors.disabledFg,
                    size: 22,
                  ),
          ),
        ),
      ),
    );
  }
}

class _EmptyChat extends StatelessWidget {
  const _EmptyChat({required this.hint});
  final String hint;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: LuxColors.lime.withValues(alpha: 0.45),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(Icons.forum_rounded, size: 34),
            ),
            const SizedBox(height: 16),
            Text(
              'Start the conversation',
              style: LuxTypography.sectionTitle,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              hint,
              style: LuxTypography.bodyMuted,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _DayChip extends StatelessWidget {
  const _DayChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: LuxColors.surface.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: LuxColors.line),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: LuxColors.muted,
          ),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.mine,
    required this.pending,
    required this.label,
    required this.body,
    required this.time,
  });

  final bool mine;
  final bool pending;
  final String label;
  final String body;
  final String time;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(18),
      topRight: const Radius.circular(18),
      bottomLeft: Radius.circular(mine ? 18 : 6),
      bottomRight: Radius.circular(mine ? 6 : 18),
    );
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.78,
        ),
        child: Opacity(
          opacity: pending ? 0.72 : 1,
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
            decoration: BoxDecoration(
              color: mine ? LuxColors.ink : LuxColors.surface,
              borderRadius: radius,
              border: mine ? null : Border.all(color: LuxColors.line),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: mine
                            ? LuxColors.lime.withValues(alpha: 0.9)
                            : LuxColors.muted,
                      ),
                    ),
                    if (time.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Text(
                        time,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: mine ? Colors.white54 : LuxColors.mutedSoft,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                    fontSize: 15,
                    color: mine ? LuxColors.textOnInk : LuxColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
