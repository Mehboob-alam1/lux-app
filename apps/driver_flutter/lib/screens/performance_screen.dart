import 'package:flutter/material.dart';
import '../theme/lux_colors.dart';
import '../widgets/lux_chrome.dart';

class PerformanceScreen extends StatelessWidget {
  const PerformanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: const [
            Text(
              'Performance',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800),
            ),
            SizedBox(height: 16),
            LuxCard(
              child: Text(
                'On-time · Completion · Cancellations. Appeal eligible decisions with evidence — no unexplained punishment.',
                style: TextStyle(color: LuxColors.muted, height: 1.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
