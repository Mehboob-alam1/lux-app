import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/app_prefs.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../widgets/lux_chrome.dart';

class _Slide {
  const _Slide({
    required this.title,
    required this.body,
    required this.icon,
  });
  final String title;
  final String body;
  final IconData icon;
}

const _slides = [
  _Slide(
    title: 'Airport & city transfers',
    body:
        'Book black-car rides with clear pricing before you confirm — no surge surprises.',
    icon: Icons.flight_takeoff_rounded,
  ),
  _Slide(
    title: 'Track your chauffeur',
    body:
        'Follow live trip status from dispatch through arrival, with support when you need it.',
    icon: Icons.route_rounded,
  ),
  _Slide(
    title: 'Your profile, your prefs',
    body:
        'Save your name and notification preferences so every booking feels personal.',
    icon: Icons.person_outline_rounded,
  ),
];

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _page = PageController();
  int _index = 0;
  bool _busy = false;

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await AppPrefs.setOnboardingCompleted();
      if (!mounted) return;
      context.go('/auth');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _next() {
    if (_index >= _slides.length - 1) {
      _finish();
      return;
    }
    _page.nextPage(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final last = _index == _slides.length - 1;
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            LuxSpacing.screenH,
            LuxSpacing.sm,
            LuxSpacing.screenH,
            LuxSpacing.lg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _busy ? null : _finish,
                  child: const Text('Skip'),
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _page,
                  itemCount: _slides.length,
                  onPageChanged: (i) => setState(() => _index = i),
                  itemBuilder: (context, i) {
                    final s = _slides[i];
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Spacer(flex: 2),
                        Container(
                          width: 88,
                          height: 88,
                          alignment: Alignment.center,
                          decoration: const BoxDecoration(
                            color: LuxColors.lime,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(s.icon, size: 40, color: LuxColors.ink),
                        ),
                        const SizedBox(height: LuxSpacing.lg),
                        const Text(
                          'LUX',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 3,
                          ),
                        ),
                        const SizedBox(height: LuxSpacing.sm),
                        Text(s.title, style: LuxTypography.display(context)),
                        const SizedBox(height: LuxSpacing.sm),
                        Text(s.body, style: LuxTypography.bodyMuted),
                        const Spacer(flex: 3),
                      ],
                    );
                  },
                ),
              ),
              Row(
                children: [
                  for (var i = 0; i < _slides.length; i++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      margin: const EdgeInsets.only(right: 6),
                      height: 6,
                      width: i == _index ? 22 : 6,
                      decoration: BoxDecoration(
                        color: i == _index
                            ? LuxColors.ink
                            : LuxColors.ink.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: LuxSpacing.md),
              LuxPrimaryButton(
                label: last ? 'Get started' : 'Continue',
                loading: _busy,
                onPressed: _next,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
