import 'dart:math' as math;

class LatLng {
  const LatLng(this.lat, this.lng);
  final double lat;
  final double lng;
}

abstract final class GeoMath {
  static double haversineKm(LatLng a, LatLng b) {
    const r = 6371.0;
    final dLat = _rad(b.lat - a.lat);
    final dLng = _rad(b.lng - a.lng);
    final la1 = _rad(a.lat);
    final la2 = _rad(b.lat);
    final h = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(la1) * math.cos(la2) * math.sin(dLng / 2) * math.sin(dLng / 2);
    return 2 * r * math.asin(math.sqrt(h));
  }

  static int etaMinutes(double distanceKm, {double kmPerHour = 28}) {
    return math.max(8, (distanceKm / kmPerHour * 60).round());
  }

  static double _rad(double deg) => deg * math.pi / 180;
}
