import 'package:flutter/material.dart';

import '../theme/lux_colors.dart';

/// Presentation helpers for real booking docs — no invented state.
abstract final class BookingUi {
  static bool isActive(String? status) {
    final s = status ?? '';
    return s.isNotEmpty &&
        s != 'COMPLETED' &&
        s != 'CANCELLED' &&
        s != 'NO_SHOW';
  }

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
      case 'QUOTE_READY':
      case 'PAYMENT_AUTHORIZED':
      case 'ASSIGNMENT_PENDING':
      case 'OFFERED':
        return LuxColors.statusPending;
      case 'ASSIGNED':
      case 'DRIVER_EN_ROUTE':
      case 'ARRIVED':
        return LuxColors.statusAssigned;
      case 'IN_PROGRESS':
      case 'PASSENGER_ON_BOARD':
        return LuxColors.statusActive;
      case 'COMPLETED':
        return LuxColors.statusComplete;
      case 'CANCELLED':
      case 'NO_SHOW':
        return LuxColors.statusCancelled;
      default:
        return LuxColors.info;
    }
  }

  static String fare(Map<String, dynamic> b) {
    final minor = (b['customerPriceMinor'] as num?)?.toInt() ?? 0;
    final cur = b['currency'] as String? ?? 'CAD';
    return '\$${(minor / 100).toStringAsFixed(2)} $cur';
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

  static String routeSummary(Map<String, dynamic> b) {
    final pickup = placeLabel(b, 'PICKUP') ?? 'Pickup';
    final dropoff = placeLabel(b, 'DROPOFF') ?? 'Dropoff';
    return '$pickup → $dropoff';
  }

  static String? scheduleLabel(Map<String, dynamic> b) {
    final raw = b['scheduledAt'] as String?;
    if (raw == null || raw.isEmpty) return null;
    final dt = DateTime.tryParse(raw)?.toLocal();
    if (dt == null) return raw;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final m = dt.minute.toString().padLeft(2, '0');
    final am = dt.hour >= 12 ? 'PM' : 'AM';
    return '${months[dt.month - 1]} ${dt.day} · $h:$m $am';
  }
}
