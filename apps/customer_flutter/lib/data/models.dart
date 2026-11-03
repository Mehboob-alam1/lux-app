enum TripStatus {
  confirmed,
  driverAssigned,
  enRoute,
  arrived,
  inProgress,
  completed,
  cancelled,
}

extension TripStatusLabel on TripStatus {
  String get label => switch (this) {
        TripStatus.confirmed => 'Confirmed',
        TripStatus.driverAssigned => 'Driver assigned',
        TripStatus.enRoute => 'Driver en route',
        TripStatus.arrived => 'Driver arrived',
        TripStatus.inProgress => 'In progress',
        TripStatus.completed => 'Completed',
        TripStatus.cancelled => 'Cancelled',
      };
}

class Place {
  const Place({
    required this.label,
    required this.address,
    this.lat = 43.65,
    this.lng = -79.38,
  });
  final String label;
  final String address;
  final double lat;
  final double lng;
}

class VehicleClass {
  const VehicleClass({
    required this.id,
    required this.name,
    required this.tagline,
    required this.passengers,
    required this.luggage,
    required this.baseMinor,
  });
  final String id;
  final String name;
  final String tagline;
  final int passengers;
  final int luggage;
  final int baseMinor;
}

class Trip {
  Trip({
    required this.id,
    required this.pickup,
    required this.dropoff,
    required this.scheduledAt,
    required this.vehicleClassId,
    required this.vehicleClassName,
    required this.passengers,
    required this.luggage,
    required this.totalMinor,
    required this.currency,
    required this.status,
    this.flightNumber,
    this.addons = const [],
    this.driverName,
    this.vehiclePlate,
    this.notes,
  });

  final String id;
  final Place pickup;
  final Place dropoff;
  final DateTime scheduledAt;
  final String vehicleClassId;
  final String vehicleClassName;
  final int passengers;
  final int luggage;
  final int totalMinor;
  final String currency;
  TripStatus status;
  final String? flightNumber;
  final List<String> addons;
  final String? driverName;
  final String? vehiclePlate;
  final String? notes;

  String get fareLabel =>
      '\$${(totalMinor / 100).toStringAsFixed(2)} $currency';
}

class SupportCase {
  SupportCase({
    required this.id,
    required this.subject,
    required this.message,
    required this.createdAt,
    this.bookingId,
    this.status = 'Open',
  });
  final String id;
  final String subject;
  final String message;
  final DateTime createdAt;
  final String? bookingId;
  String status;
}

class BookingDraft {
  Place? pickup;
  Place? dropoff;
  DateTime? scheduledAt;
  String vehicleClassId = 'COMFORT';
  int passengers = 2;
  int luggage = 2;
  String? flightNumber;
  bool meetAndGreet = false;
  final Set<String> addons = {};
  String? notes;

  bool get canReview =>
      pickup != null && dropoff != null && scheduledAt != null;
}
