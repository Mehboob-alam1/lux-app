import 'package:flutter/material.dart';

import '../theme/lux_colors.dart';

class TripActionGuide {
  const TripActionGuide({
    required this.action,
    required this.label,
    this.subtitle,
    this.primary = true,
    this.destructive = false,
  });

  final String action;
  final String label;
  final String? subtitle;
  final bool primary;
  final bool destructive;
}

/// Maps live booking status → allowed Cloud Function tripLifecycle actions.
abstract final class TripGuide {
  static String label(String? status) {
    final s = (status ?? 'UNKNOWN').trim();
    if (s.isEmpty) return 'Unknown';
    return s
        .split('_')
        .where((p) => p.isNotEmpty)
        .map((p) => '${p[0]}${p.substring(1).toLowerCase()}')
        .join(' ');
  }

  static Color color(String? status) {
    switch (status) {
      case 'ASSIGNED':
      case 'DRIVER_EN_ROUTE':
      case 'DRIVER_ARRIVED':
      case 'WAITING':
        return LuxColors.statusAssigned;
      case 'PASSENGER_ONBOARD':
      case 'IN_PROGRESS':
        return LuxColors.statusActive;
      case 'COMPLETED':
      case 'PAYMENT_CAPTURED':
        return LuxColors.statusComplete;
      case 'CUSTOMER_CANCELLED':
      case 'DRIVER_CANCELLED':
      case 'PASSENGER_NO_SHOW':
      case 'DRIVER_NO_SHOW':
        return LuxColors.statusCancelled;
      default:
        return LuxColors.info;
    }
  }

  static bool isOpen(String? status) {
    final s = status ?? '';
    return s.isNotEmpty &&
        s != 'COMPLETED' &&
        s != 'PAYMENT_CAPTURED' &&
        s != 'CANCELLED' &&
        s != 'CUSTOMER_CANCELLED' &&
        s != 'DRIVER_CANCELLED' &&
        s != 'PASSENGER_NO_SHOW' &&
        s != 'DRIVER_NO_SHOW';
  }

  static List<TripActionGuide> actionsFor(String? status) {
    switch (status) {
      case 'ASSIGNED':
        return const [
          TripActionGuide(
            action: 'EN_ROUTE',
            label: 'En route to pickup',
            subtitle: 'Notify the rider you are on the way',
          ),
        ];
      case 'DRIVER_EN_ROUTE':
        return const [
          TripActionGuide(
            action: 'ARRIVED',
            label: 'Arrived at pickup',
            subtitle: 'You are at the pickup point',
          ),
        ];
      case 'DRIVER_ARRIVED':
        return const [
          TripActionGuide(
            action: 'PASSENGER_ONBOARD',
            label: 'Passenger onboard',
            subtitle: 'Rider is in the vehicle',
          ),
          TripActionGuide(
            action: 'START_WAIT',
            label: 'Start wait time',
            subtitle: 'Optional wait billing window',
            primary: false,
          ),
          TripActionGuide(
            action: 'CONTACT_ATTEMPT',
            label: 'Log contact attempt',
            subtitle: 'Record that you tried to reach the rider',
            primary: false,
          ),
          TripActionGuide(
            action: 'PASSENGER_NO_SHOW',
            label: 'Passenger no-show',
            subtitle: 'Ends the trip as no-show',
            primary: false,
            destructive: true,
          ),
        ];
      case 'WAITING':
        return const [
          TripActionGuide(
            action: 'PASSENGER_ONBOARD',
            label: 'Passenger onboard',
          ),
          TripActionGuide(
            action: 'PASSENGER_NO_SHOW',
            label: 'Passenger no-show',
            primary: false,
            destructive: true,
          ),
        ];
      case 'PASSENGER_ONBOARD':
        return const [
          TripActionGuide(
            action: 'START_TRIP',
            label: 'Start trip',
            subtitle: 'Begin the paid portion of the ride',
          ),
        ];
      case 'IN_PROGRESS':
        return const [
          TripActionGuide(
            action: 'COMPLETE',
            label: 'Complete trip',
            subtitle: 'Dropoff finished — capture payout',
          ),
        ];
      default:
        return const [];
    }
  }

  static String? placeLabel(Map<String, dynamic> b, String kind) {
    final itin = b['itinerary'];
    if (itin is! List) return null;
    for (final raw in itin) {
      if (raw is! Map) continue;
      if (raw['kind']?.toString() != kind) continue;
      final place = raw['place'];
      if (place is Map) {
        final label = place['label']?.toString();
        if (label != null && label.isNotEmpty) return label;
        final address = place['address']?.toString();
        if (address != null && address.isNotEmpty) return address;
      }
    }
    return null;
  }
}
