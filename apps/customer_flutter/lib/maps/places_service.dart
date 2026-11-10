import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;

import '../data/lux_catalog.dart';
import '../data/models.dart';
import 'lux_map_config.dart';

class PlaceSuggestion {
  const PlaceSuggestion({
    required this.placeId,
    required this.label,
    required this.address,
  });
  final String placeId;
  final String label;
  final String address;
}

/// Catalog always available. Google Places API (New) when a key is present.
abstract final class PlacesService {
  static String? _sessionToken;

  static String _newSession() {
    final r = Random();
    final id = List.generate(16, (_) => r.nextInt(256))
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
    _sessionToken = id;
    return id;
  }

  static Future<List<Place>> catalogPickup() async =>
      LuxCatalog.pickupSuggestions;

  static Future<List<Place>> catalogDropoff() async =>
      LuxCatalog.dropoffSuggestions;

  static List<PlaceSuggestion> _catalogMatches(String q) {
    final all = [
      ...LuxCatalog.pickupSuggestions,
      ...LuxCatalog.dropoffSuggestions,
    ];
    return all
        .where(
          (p) =>
              p.label.toLowerCase().contains(q.toLowerCase()) ||
              p.address.toLowerCase().contains(q.toLowerCase()),
        )
        .map(
          (p) => PlaceSuggestion(
            placeId: 'catalog:${p.label}',
            label: p.label,
            address: p.address,
          ),
        )
        .toList();
  }

  static Future<List<PlaceSuggestion>> autocomplete(String input) async {
    final q = input.trim();
    if (q.length < 2) return const [];
    if (!LuxMapConfig.hasPlacesKey) return _catalogMatches(q);

    try {
      final token = _sessionToken ?? _newSession();
      final res = await http.post(
        Uri.parse('https://places.googleapis.com/v1/places:autocomplete'),
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': LuxMapConfig.effectivePlacesKey,
          'X-Goog-FieldMask':
              'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: jsonEncode({
          'input': q,
          'sessionToken': token,
          'includedRegionCodes': ['ca'],
          'locationBias': {
            'circle': {
              'center': {'latitude': 43.65, 'longitude': -79.38},
              'radius': 50000.0,
            },
          },
        }),
      );
      if (res.statusCode != 200) {
        return _catalogMatches(q);
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final suggestions = (body['suggestions'] as List? ?? const []);
      final out = <PlaceSuggestion>[];
      for (final raw in suggestions) {
        final m = Map<String, dynamic>.from(raw as Map);
        final pred = Map<String, dynamic>.from(
          m['placePrediction'] as Map? ?? {},
        );
        if (pred.isEmpty) continue;
        final text = Map<String, dynamic>.from(pred['text'] as Map? ?? {});
        final structured = Map<String, dynamic>.from(
          pred['structuredFormat'] as Map? ?? {},
        );
        final main = Map<String, dynamic>.from(
          structured['mainText'] as Map? ?? {},
        );
        final placeId = (pred['placeId'] as String?) ?? '';
        if (placeId.isEmpty) continue;
        out.add(
          PlaceSuggestion(
            placeId: placeId,
            label: (main['text'] as String?) ??
                (text['text'] as String?) ??
                'Place',
            address: (text['text'] as String?) ?? '',
          ),
        );
      }
      if (out.isEmpty) return _catalogMatches(q);
      return out;
    } catch (_) {
      return _catalogMatches(q);
    }
  }

  static Future<Place> resolveSuggestion(PlaceSuggestion s) async {
    if (s.placeId.startsWith('catalog:')) {
      final label = s.placeId.substring('catalog:'.length);
      final all = [
        ...LuxCatalog.pickupSuggestions,
        ...LuxCatalog.dropoffSuggestions,
      ];
      return all.firstWhere(
        (p) => p.label == label,
        orElse: () => Place(label: s.label, address: s.address),
      );
    }
    if (!LuxMapConfig.hasPlacesKey) {
      return Place(label: s.label, address: s.address);
    }

    try {
      final id = s.placeId.startsWith('places/')
          ? s.placeId.substring('places/'.length)
          : s.placeId;
      final token = _sessionToken ?? _newSession();
      final res = await http.get(
        Uri.parse('https://places.googleapis.com/v1/places/$id').replace(
          queryParameters: {'sessionToken': token},
        ),
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': LuxMapConfig.effectivePlacesKey,
          'X-Goog-FieldMask':
              'id,displayName,formattedAddress,location',
        },
      );
      _sessionToken = null; // end billing session
      if (res.statusCode != 200) {
        return Place(label: s.label, address: s.address);
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final display = Map<String, dynamic>.from(
        body['displayName'] as Map? ?? {},
      );
      final location = Map<String, dynamic>.from(
        body['location'] as Map? ?? {},
      );
      return Place(
        label: (display['text'] as String?) ?? s.label,
        address: (body['formattedAddress'] as String?) ?? s.address,
        lat: (location['latitude'] as num?)?.toDouble() ?? 43.65,
        lng: (location['longitude'] as num?)?.toDouble() ?? -79.38,
      );
    } catch (_) {
      return Place(label: s.label, address: s.address);
    }
  }
}
