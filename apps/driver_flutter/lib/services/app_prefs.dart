import 'package:shared_preferences/shared_preferences.dart';

/// Local prefs — first-run welcome for drivers.
class AppPrefs {
  AppPrefs._();
  static const _welcomeDone = 'lux_driver_welcome_done_v1';

  static Future<bool> hasSeenWelcome() async {
    final p = await SharedPreferences.getInstance();
    return p.getBool(_welcomeDone) ?? false;
  }

  static Future<void> setWelcomeSeen([bool value = true]) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(_welcomeDone, value);
  }
}
