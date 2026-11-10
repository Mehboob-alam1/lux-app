import 'package:geolocator/geolocator.dart';

import 'lux_logger.dart';

class DriverFix {
  const DriverFix({
    required this.lat,
    required this.lng,
    required this.accuracyM,
    required this.fromDevice,
    this.label,
  });
  final double lat;
  final double lng;
  final double accuracyM;
  final bool fromDevice;
  final String? label;
}

/// Real GPS when permission granted; otherwise Toronto demo fallback (honest).
abstract final class LocationService {
  static const fallback = DriverFix(
    lat: 43.645,
    lng: -79.38,
    accuracyM: 999,
    fromDevice: false,
    label: 'Demo fallback (Toronto)',
  );

  static Future<DriverFix> current({bool requestPermission = true}) async {
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        LuxLogger.warn('location_disabled', {});
        return fallback;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied && requestPermission) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        LuxLogger.warn('location_permission_denied', {
          'permission': permission.toString(),
        });
        return fallback;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
      LuxLogger.info('location_fix', {
        'lat': pos.latitude.toStringAsFixed(5),
        'lng': pos.longitude.toStringAsFixed(5),
        'acc': pos.accuracy.round(),
      });
      return DriverFix(
        lat: pos.latitude,
        lng: pos.longitude,
        accuracyM: pos.accuracy,
        fromDevice: true,
        label: 'Device GPS ±${pos.accuracy.round()}m',
      );
    } catch (e) {
      LuxLogger.warn('location_error', {'error': e.toString()});
      return fallback;
    }
  }
}
