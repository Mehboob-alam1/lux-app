import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/driver_api.dart';
import '../theme/lux_colors.dart';

class DriverTripsScreen extends StatelessWidget {
  const DriverTripsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: StreamBuilder(
          stream: DriverApi.instance.watchAssignedBookings(),
          builder: (context, snap) {
            final rows = snap.data ?? const <Map<String, dynamic>>[];
            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              children: [
                const Text('Trips',
                    style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900)),
                const SizedBox(height: 12),
                if (rows.isEmpty)
                  const Text('No assigned bookings', style: TextStyle(color: LuxColors.muted))
                else
                  ...rows.map((b) {
                    final id = b['bookingId'] as String;
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(id, style: const TextStyle(fontWeight: FontWeight.w800)),
                      subtitle: Text('${b['currentStatus']}'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/active-trip/$id'),
                    );
                  }),
              ],
            );
          },
        ),
      ),
    );
  }
}
