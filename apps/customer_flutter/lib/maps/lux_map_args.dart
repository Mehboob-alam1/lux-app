import 'geo_math.dart';

/// Payload for the full-screen Google Map route.
class LuxMapArgs {
  const LuxMapArgs({
    required this.pickup,
    required this.dropoff,
    this.pickupLabel,
    this.dropoffLabel,
    this.title = 'Route map',
  });

  final LatLng pickup;
  final LatLng dropoff;
  final String? pickupLabel;
  final String? dropoffLabel;
  final String title;

  factory LuxMapArgs.fromQuery(Map<String, String> q) {
    double parse(String k, double fallback) =>
        double.tryParse(q[k] ?? '') ?? fallback;
    return LuxMapArgs(
      pickup: LatLng(parse('plat', 43.65), parse('plng', -79.38)),
      dropoff: LatLng(parse('dlat', 43.65), parse('dlng', -79.38)),
      pickupLabel: q['plabel'],
      dropoffLabel: q['dlabel'],
      title: q['title']?.isNotEmpty == true ? q['title']! : 'Route map',
    );
  }

  Map<String, String> toQuery() => {
        'plat': pickup.lat.toString(),
        'plng': pickup.lng.toString(),
        'dlat': dropoff.lat.toString(),
        'dlng': dropoff.lng.toString(),
        if (pickupLabel != null && pickupLabel!.isNotEmpty)
          'plabel': pickupLabel!,
        if (dropoffLabel != null && dropoffLabel!.isNotEmpty)
          'dlabel': dropoffLabel!,
        'title': title,
      };
}
