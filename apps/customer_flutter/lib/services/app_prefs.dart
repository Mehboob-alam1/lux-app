import 'package:shared_preferences/shared_preferences.dart';

/// Local prefs — onboarding completion, lightweight UX flags.
class AppPrefs {
  AppPrefs._();
  static const _onboardingDone = 'lux_customer_onboarding_done_v1';

  static Future<bool> hasCompletedOnboarding() async {
    final p = await SharedPreferences.getInstance();
    return p.getBool(_onboardingDone) ?? false;
  }

  static Future<void> setOnboardingCompleted([bool value = true]) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(_onboardingDone, value);
  }
}
