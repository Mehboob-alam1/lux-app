import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/booking_api.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../widgets/lux_chrome.dart';
import '../widgets/lux_feedback.dart';
import '../widgets/lux_text_field.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  final _form = GlobalKey<FormState>();
  final _subject = TextEditingController();
  final _message = TextEditingController();
  bool _busy = false;
  bool _safety = false;
  bool _compose = false;

  @override
  void dispose() {
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final res = await BookingApi.instance.openSupport(
        subject: _subject.text.trim(),
        message: _message.text.trim(),
        escalateSafety: _safety,
      );
      _subject.clear();
      _message.clear();
      setState(() {
        _safety = false;
        _compose = false;
      });
      if (!mounted) return;
      final id = (res['caseId'] ?? res['id'] ?? '').toString();
      if (id.isNotEmpty && res['type'] != 'INCIDENT') {
        context.push('/support/$id');
      } else {
        LuxFeedback.success(
          context,
          res['type'] == 'INCIDENT'
              ? 'Safety incident opened · ${res['incidentId'] ?? id}'
              : 'Case opened · $id',
        );
      }
    } catch (e) {
      if (!mounted) return;
      LuxFeedback.error(
        context,
        e,
        fallback: BookingApi.instance.mapError(e),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _statusLabel(String raw) {
    switch (raw.toUpperCase()) {
      case 'PENDING_CUSTOMER':
        return 'Reply needed';
      case 'PENDING_INTERNAL':
        return 'Ops reviewing';
      case 'RESOLVED':
        return 'Resolved';
      case 'CLOSED':
        return 'Closed';
      case 'REOPENED':
        return 'Reopened';
      case 'OPEN':
        return 'Open';
      default:
        return raw.isEmpty ? 'Open' : raw;
    }
  }

  Color _statusColor(String raw) {
    switch (raw.toUpperCase()) {
      case 'PENDING_CUSTOMER':
        return LuxColors.warning;
      case 'PENDING_INTERNAL':
      case 'OPEN':
      case 'REOPENED':
        return LuxColors.info;
      case 'RESOLVED':
        return LuxColors.success;
      case 'CLOSED':
        return LuxColors.muted;
      default:
        return LuxColors.muted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 100),
          children: [
            Text('Support', style: LuxTypography.display(context)),
            const SizedBox(height: 8),
            const Text(
              'Message LUX ops about a booking, or escalate a safety issue.',
              style: LuxTypography.bodyMuted,
            ),
            const SizedBox(height: LuxSpacing.lg),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    LuxColors.lime.withValues(alpha: 0.55),
                    LuxColors.surface,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: LuxColors.line),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: LuxColors.ink,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.forum_rounded,
                      color: LuxColors.lime,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Live chat with ops',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _compose
                              ? 'Fill the form below to open a case.'
                              : 'Open a case and chat in real time.',
                          style: LuxTypography.bodyMuted.copyWith(fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: LuxSpacing.md),
            LuxPrimaryButton(
              label: _compose ? 'Cancel new case' : 'Start new case',
              onPressed: () => setState(() => _compose = !_compose),
            ),
            if (_compose) ...[
              const SizedBox(height: LuxSpacing.md),
              LuxCard(
                child: Form(
                  key: _form,
                  child: Column(
                    children: [
                      LuxTextField(
                        controller: _subject,
                        label: 'Subject',
                        hint: 'What do you need help with?',
                        prefixIcon: Icons.subject_outlined,
                        enabled: !_busy,
                        validator: (v) => LuxValidators.required(v, 'Subject'),
                      ),
                      const SizedBox(height: LuxSpacing.fieldGap),
                      LuxTextField(
                        controller: _message,
                        label: 'Message',
                        hint: 'Share booking details and what went wrong',
                        prefixIcon: Icons.chat_bubble_outline,
                        enabled: !_busy,
                        minLines: 3,
                        maxLines: 5,
                        validator: (v) => LuxValidators.required(v, 'Message'),
                      ),
                      const SizedBox(height: LuxSpacing.sm),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        title: const Text(
                          'Safety emergency',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: const Text(
                          'Escalate to the safety desk immediately',
                        ),
                        value: _safety,
                        activeThumbColor: LuxColors.ink,
                        activeTrackColor: LuxColors.lime,
                        onChanged: _busy
                            ? null
                            : (v) => setState(() => _safety = v),
                      ),
                      LuxPrimaryButton(
                        label: _busy ? 'Opening…' : 'Open case & chat',
                        loading: _busy,
                        enabled: !_busy,
                        onPressed: _submit,
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: LuxSpacing.lg),
            const LuxSectionLabel('Your conversations'),
            const SizedBox(height: 10),
            StreamBuilder<List<Map<String, dynamic>>>(
              stream: BookingApi.instance.watchMySupportCases(),
              builder: (context, snap) {
                if (snap.hasError) {
                  return LuxCard(
                    child: Text(
                      'Could not load cases.\n${snap.error}',
                      style: LuxTypography.bodyMuted,
                    ),
                  );
                }
                final rows = snap.data ?? const [];
                if (snap.connectionState == ConnectionState.waiting &&
                    rows.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (rows.isEmpty) {
                  return LuxCard(
                    child: Column(
                      children: [
                        Icon(
                          Icons.chat_bubble_outline_rounded,
                          size: 36,
                          color: LuxColors.muted.withValues(alpha: 0.7),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'No support chats yet',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Start a case above to message ops.',
                          style: LuxTypography.bodyMuted,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                }
                return Column(
                  children: rows.map((c) {
                    final id = (c['caseId'] ?? c['id']).toString();
                    final status =
                        (c['status']?.toString() ?? 'OPEN').toUpperCase();
                    final color = _statusColor(status);
                    final preview =
                        c['lastMessagePreview']?.toString().trim() ?? '';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Material(
                        color: LuxColors.surface,
                        borderRadius: BorderRadius.circular(18),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(18),
                          onTap: () => context.push('/support/$id'),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: LuxColors.line),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 46,
                                  height: 46,
                                  decoration: BoxDecoration(
                                    color: LuxColors.surfaceMuted,
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: Icon(
                                    status == 'CLOSED'
                                        ? Icons.lock_outline_rounded
                                        : Icons.support_agent_rounded,
                                    color: LuxColors.ink,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        c['subject']?.toString() ?? 'Support',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 15,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        preview.isNotEmpty
                                            ? preview
                                            : 'Tap to open chat',
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: LuxTypography.bodyMuted
                                            .copyWith(fontSize: 13),
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
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: color.withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(99),
                                      ),
                                      child: Text(
                                        _statusLabel(status),
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w800,
                                          color: color,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    const Icon(
                                      Icons.chevron_right_rounded,
                                      color: LuxColors.mutedSoft,
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
