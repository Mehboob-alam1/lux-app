import 'models.dart';

/// Aligned with emulator seed (`functions/src/scripts/seed.ts`).
abstract final class LuxCatalog {
  static const pickupSuggestions = <Place>[
    Place(
      label: 'Home',
      address: '88 Harbour St, Toronto, ON',
      lat: 43.641,
      lng: -79.377,
    ),
    Place(
      label: 'Downtown office',
      address: '100 King St W, Toronto, ON',
      lat: 43.649,
      lng: -79.382,
    ),
    Place(
      label: 'Union Station',
      address: '65 Front St W, Toronto, ON',
      lat: 43.645,
      lng: -79.381,
    ),
  ];

  static const dropoffSuggestions = <Place>[
    Place(
      label: 'Toronto Pearson (YYZ)',
      address: '6301 Silver Dart Dr, Mississauga, ON',
      lat: 43.678,
      lng: -79.625,
    ),
    Place(
      label: 'Billy Bishop (YTZ)',
      address: '2 Eireann Quay, Toronto, ON',
      lat: 43.628,
      lng: -79.396,
    ),
    Place(
      label: 'Yorkville',
      address: '55 Avenue Rd, Toronto, ON',
      lat: 43.671,
      lng: -79.394,
    ),
  ];

  static const classes = <VehicleClass>[
    VehicleClass(
      id: 'COMFORT',
      name: 'Comfort',
      tagline: 'Seeded demo class — up to 3 pax / 2 bags',
      passengers: 3,
      luggage: 2,
      baseMinor: 4500,
    ),
    VehicleClass(
      id: 'EXECUTIVE',
      name: 'Executive',
      tagline: 'Business sedan — up to 3 pax / 2 bags',
      passengers: 3,
      luggage: 2,
      baseMinor: 5500,
    ),
    VehicleClass(
      id: 'LUXURY_SUV',
      name: 'Luxury SUV',
      tagline: 'SUV — up to 5 pax / 5 bags',
      passengers: 5,
      luggage: 5,
      baseMinor: 7500,
    ),
  ];

  static VehicleClass classById(String id) =>
      classes.firstWhere((c) => c.id == id, orElse: () => classes.first);

  static Map<String, dynamic> placePayload(Place p) => {
        'label': p.label,
        'address': p.address,
        'location': {'lat': p.lat, 'lng': p.lng},
      };
}
