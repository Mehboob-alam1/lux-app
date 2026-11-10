import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'lux_catalog.dart';
import 'models.dart';

final bookingDraftProvider =
    ChangeNotifierProvider<BookingDraftController>((ref) {
  return BookingDraftController();
});

class BookingDraftController extends ChangeNotifier {
  Place? pickup;
  Place? dropoff;
  DateTime scheduledAt = DateTime.now().add(const Duration(hours: 3));
  String vehicleClassId = 'COMFORT';
  int passengers = 2;
  int luggage = 2;
  String? flightNumber;
  bool meetAndGreet = false;

  bool get canSubmit => pickup != null && dropoff != null;

  void setPickup(Place p) {
    pickup = p;
    notifyListeners();
  }

  void setDropoff(Place p) {
    dropoff = p;
    notifyListeners();
  }

  void setSchedule(DateTime t) {
    scheduledAt = t;
    notifyListeners();
  }

  void setClass(String id) {
    vehicleClassId = id;
    final vc = LuxCatalog.classById(id);
    passengers = passengers.clamp(1, vc.passengers);
    luggage = luggage.clamp(0, vc.luggage);
    notifyListeners();
  }

  void setPassengers(int n) {
    passengers = n;
    notifyListeners();
  }

  void setLuggage(int n) {
    luggage = n;
    notifyListeners();
  }

  void setFlight(String? flight, {bool? meet}) {
    flightNumber = (flight == null || flight.trim().isEmpty) ? null : flight.trim();
    if (meet != null) meetAndGreet = meet;
    notifyListeners();
  }
}
