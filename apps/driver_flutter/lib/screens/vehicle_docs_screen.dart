import 'package:flutter/material.dart';
import '../theme/lux_colors.dart';
import '../widgets/lux_chrome.dart';

class VehicleDocsScreen extends StatelessWidget {
  const VehicleDocsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: const [
            Text(
              'Vehicle & Documents',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800),
            ),
            SizedBox(height: 16),
            LuxCard(
              color: LuxColors.lime,
              child: Text(
                'Expired or unapproved docs block online, accept, and trip start — enforced by Cloud Functions.',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            SizedBox(height: 12),
            LuxCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Licence / insurance / inspection', style: TextStyle(fontWeight: FontWeight.w800)),
                  SizedBox(height: 6),
                  Text(
                    'Upload via Storage rules; review state flips eligibility server-side.',
                    style: TextStyle(color: LuxColors.muted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
