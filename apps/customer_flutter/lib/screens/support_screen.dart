import 'package:flutter/material.dart';
import '../services/booking_api.dart';
import '../theme/lux_colors.dart';
import '../widgets/lux_chrome.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  final _subject = TextEditingController();
  final _message = TextEditingController();
  bool busy = false;
  String? notice;

  @override
  void dispose() {
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      busy = true;
      notice = null;
    });
    try {
      final res = await BookingApi.instance.openSupport(
        subject: _subject.text.trim(),
        message: _message.text.trim(),
      );
      _subject.clear();
      _message.clear();
      setState(() => notice = 'Opened ${res['caseId'] ?? res['id'] ?? res}');
    } catch (e) {
      setState(() => notice = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
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
            const Text('Support',
                style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            const Text('createSupportCase callable',
                style: TextStyle(color: LuxColors.muted)),
            const SizedBox(height: 20),
            LuxCard(
              child: Column(
                children: [
                  TextField(
                    controller: _subject,
                    decoration: const InputDecoration(
                      labelText: 'Subject',
                      border: InputBorder.none,
                    ),
                  ),
                  const Divider(height: 1),
                  TextField(
                    controller: _message,
                    minLines: 3,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText: 'Message',
                      border: InputBorder.none,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            LuxPrimaryButton(
              label: busy ? 'Submitting…' : 'Submit case',
              enabled: !busy,
              onPressed: _submit,
            ),
            if (notice != null) ...[
              const SizedBox(height: 12),
              Text(notice!),
            ],
            const SizedBox(height: 24),
            const LuxSectionLabel('Your cases'),
            const SizedBox(height: 10),
            StreamBuilder(
              stream: BookingApi.instance.watchMySupportCases(),
              builder: (context, snap) {
                final rows = snap.data ?? const <Map<String, dynamic>>[];
                if (rows.isEmpty) {
                  return const LuxCard(
                    child: Text('No cases yet', style: TextStyle(color: LuxColors.muted)),
                  );
                }
                return Column(
                  children: rows
                      .map(
                        (c) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: LuxCard(
                            child: Text(
                              '${c['id'] ?? c['caseId']} · ${c['subject'] ?? c['status']}',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                      )
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
