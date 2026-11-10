import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/driver_api.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../widgets/lux_chrome.dart';
import '../widgets/lux_feedback.dart';
import '../widgets/lux_text_field.dart';

class HelpSafetyScreen extends StatefulWidget {
  const HelpSafetyScreen({super.key});

  @override
  State<HelpSafetyScreen> createState() => _HelpSafetyScreenState();
}

class _HelpSafetyScreenState extends State<HelpSafetyScreen> {
  final _form = GlobalKey<FormState>();
  final _subject = TextEditingController();
  final _message = TextEditingController();
  bool _busy = false;
  bool _safety = false;
  bool _compose = false;

  static const _quick = [
    (
      'Accident',
      'Report a collision or on-road incident',
      true,
    ),
    (
      'Threat / aggression',
      'Escalate immediately to safety desk',
      true,
    ),
    (
      'Medical',
      'Medical emergency guidance + ops',
      true,
    ),
    (
      'Breakdown',
      'Vehicle issue — booking may need reassignment',
      false,
    ),
    (
      'Cleaning / damage',
      'Evidence for ops — no automatic customer charge',
      false,
    ),
  ];

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
      final res = await DriverApi.instance.openSupport(
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
        context.push('/help-safety/$id');
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
        fallback: DriverApi.instance.mapError(e),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _prefill(String title, bool safety) {
    setState(() {
      _compose = true;
      _safety = safety;
      _subject.text = title;
      if (_message.text.trim().isEmpty) {
        _message.text = safety
            ? 'Safety report: $title. Location / status: '
            : 'Help request: $title. Details: ';
      }
    });
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
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
          children: [
            Row(
              children: [
                IconButton(
                  onPressed: () => context.canPop()
                      ? context.pop()
                      : context.go('/more'),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
                Expanded(
                  child: Text(
                    'Help & Safety',
                    style: LuxTypography.display(context),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Chat with ops, or escalate a safety incident immediately.',
              style: LuxTypography.bodyMuted,
            ),
            const SizedBox(height: LuxSpacing.md),
            LuxCard(
              color: LuxColors.lime.withValues(alpha: 0.45),
              child: const Text(
                'Safety incidents are not ordinary support tickets — they go straight to the safety desk.',
                style: TextStyle(fontWeight: FontWeight.w700, height: 1.4),
              ),
            ),
            const SizedBox(height: LuxSpacing.md),
            const LuxSectionLabel('Quick report'),
            const SizedBox(height: 8),
            ..._quick.map(
              (e) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: LuxCard(
                  onTap: () => _prefill(e.$1, e.$3),
                  child: Row(
                    children: [
                      Icon(
                        e.$3
                            ? Icons.warning_amber_rounded
                            : Icons.help_outline_rounded,
                        color: e.$3 ? LuxColors.error : LuxColors.ink,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              e.$1,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w800),
                            ),
                            Text(e.$2, style: LuxTypography.bodyMuted),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: LuxSpacing.md),
            LuxPrimaryButton(
              label: _compose ? 'Cancel new case' : 'Start support chat',
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
                        hint: 'What happened?',
                        prefixIcon: Icons.subject_outlined,
                        enabled: !_busy,
                        validator: (v) => LuxValidators.required(v, 'Subject'),
                      ),
                      const SizedBox(height: LuxSpacing.fieldGap),
                      LuxTextField(
                        controller: _message,
                        label: 'Details',
                        hint: 'Booking id, location, what you need from ops',
                        prefixIcon: Icons.chat_bubble_outline,
                        enabled: !_busy,
                        minLines: 3,
                        maxLines: 5,
                        validator: (v) => LuxValidators.required(v, 'Details'),
                      ),
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
              stream: DriverApi.instance.watchMySupportCases(),
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
                  return const LuxCard(
                    child: Text(
                      'No support chats yet. Use a quick report or start a case above.',
                      style: LuxTypography.bodyMuted,
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
                          onTap: () => context.push('/help-safety/$id'),
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
                                  child: const Icon(
                                    Icons.support_agent_rounded,
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
