/// Google Maps / Places configuration.
///
/// Source of truth: Firebase Remote Config
///   - `google_maps_api_key`
///   - `places_api_key`
///
/// Optional local override: `--dart-define=GOOGLE_MAPS_API_KEY=...`
/// Last resort: [fallbackKey] (same value published in Remote Config template).
abstract final class LuxMapConfig {
  /// Same key published in `firebase/remoteconfig.template.json`.
  static const fallbackKey = 'AIzaSyCORTEDxkmT71axjYEqcifFKEb1VPAkC_0';

  static String _apiKey = const String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: '',
  );
  static String _placesKey = const String.fromEnvironment(
    'PLACES_API_KEY',
    defaultValue: '',
  );
  static String _source =
      const String.fromEnvironment('GOOGLE_MAPS_API_KEY', defaultValue: '')
              .isNotEmpty
          ? 'dart-define'
          : 'none';

  static String get apiKey {
    final k = _apiKey.trim();
    return k.isNotEmpty ? k : fallbackKey;
  }

  static String get placesKey {
    final k = _placesKey.trim();
    if (k.isNotEmpty) return k;
    return apiKey;
  }

  static String get source {
    if (_apiKey.trim().isNotEmpty) return _source;
    return 'fallback';
  }

  static bool get hasMapsKey => apiKey.isNotEmpty;
  static bool get hasPlacesKey => placesKey.isNotEmpty;

  static String get effectivePlacesKey => placesKey;

  static String get modeLabel => 'Google Maps';

  /// Apply Remote Config values (preferred over dart-define when present).
  static void applyRemote({
    String? mapsKey,
    String? placesKey,
  }) {
    final m = mapsKey?.trim() ?? '';
    final p = placesKey?.trim() ?? '';
    if (m.isNotEmpty) {
      _apiKey = m;
      _source = 'remote_config';
    }
    if (p.isNotEmpty) {
      _placesKey = p;
      if (_source != 'remote_config') {
        _source = 'remote_config';
      }
    } else if (m.isNotEmpty && _placesKey.trim().isEmpty) {
      _placesKey = m;
    }
  }

  static void ensureFallback() {
    if (_apiKey.trim().isEmpty) {
      _apiKey = fallbackKey;
      if (_source == 'none') _source = 'fallback';
    }
    if (_placesKey.trim().isEmpty) {
      _placesKey = _apiKey;
    }
  }
}
