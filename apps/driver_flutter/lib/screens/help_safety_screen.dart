import 'package:flutter/material.dart';
import '../theme/lux_colors.dart';
import '../widgets/lux_chrome.dart';

class HelpSafetyScreen extends StatelessWidget {
  const HelpSafetyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Accident', 'Safety first → incident → rescue'),
      ('Threat / aggression', 'Protected escalation'),
      ('Medical', 'Emergency guidance + ops'),
      ('Breakdown', 'Customer booking stays live → REASSIGNING'),
      ('Cleaning / damage', 'Evidence only — no automatic customer charge'),
    ];
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Text(
              'Help & Safety',
              style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            LuxCard(
              color: LuxColors.lime,
              child: const Text(
                'Safety incidents are not ordinary support tickets.',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 12),
            ...items.map(
              (e) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: LuxCard(
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('${e.$1} → createSupportCase(escalateSafety:true)'),
                      ),
                    );
                  },
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(e.$1, style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(e.$2, style: const TextStyle(color: LuxColors.muted)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
