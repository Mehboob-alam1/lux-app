import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter/foundation.dart';

import '../maps/lux_map_config.dart';
import 'lux_logger.dart';

/// Fetches Maps/Places keys from Firebase Remote Config (source of truth).
abstract final class RemoteConfigService {
  static const mapsKeyParam = 'google_maps_api_key';
  static const placesKeyParam = 'places_api_key';

  static bool ready = false;
  static String? lastError;

  static Future<void> init() async {
    LuxMapConfig.ensureFallback();
    try {
      final rc = FirebaseRemoteConfig.instance;
      await rc.setConfigSettings(
        RemoteConfigSettings(
          fetchTimeout: const Duration(seconds: 15),
          minimumFetchInterval: kDebugMode
              ? Duration.zero
              : const Duration(minutes: 5),
        ),
      );
      await rc.setDefaults({
        mapsKeyParam: LuxMapConfig.fallbackKey,
        placesKeyParam: LuxMapConfig.fallbackKey,
      });
      final activated = await rc.fetchAndActivate();
      _apply(rc);
      ready = true;
      lastError = null;
      LuxLogger.info('remote_config_ready', {
        'activated': activated,
        'maps': LuxMapConfig.hasMapsKey,
        'source': LuxMapConfig.source,
        'keyTail': LuxMapConfig.apiKey.length > 6
            ? LuxMapConfig.apiKey.substring(LuxMapConfig.apiKey.length - 6)
            : '',
      });
    } catch (e, st) {
      lastError = e.toString();
      ready = false;
      LuxMapConfig.ensureFallback();
      LuxLogger.error('remote_config_failed', const {}, e, st);
    }
  }

  static Future<void> refresh() async {
    try {
      final rc = FirebaseRemoteConfig.instance;
      await rc.fetchAndActivate();
      _apply(rc);
      LuxLogger.info('remote_config_refreshed', {
        'maps': LuxMapConfig.hasMapsKey,
        'source': LuxMapConfig.source,
      });
    } catch (e, st) {
      LuxMapConfig.ensureFallback();
      LuxLogger.error('remote_config_refresh_failed', const {}, e, st);
    }
  }

  static void _apply(FirebaseRemoteConfig rc) {
    LuxMapConfig.applyRemote(
      mapsKey: rc.getString(mapsKeyParam),
      placesKey: rc.getString(placesKeyParam),
    );
    LuxMapConfig.ensureFallback();
  }
}
