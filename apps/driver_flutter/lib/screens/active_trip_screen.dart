import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/driver_api.dart';
import '../theme/lux_colors.dart';

class ActiveTripScreen extends StatefulWidget {
  const ActiveTripScreen({super.key, required this.bookingId});
  final String bookingId;

  @override
  State<ActiveTripScreen> createState() => _ActiveTripScreenState();
}

class _ActiveTripScreenState extends State<ActiveTripScreen> {
  bool busy = false;
  String? notice;

  Future<void> _run(String action) async {
    setState(() {
      busy = true;
      notice = null;
    });
    try {
      await DriverApi.instance.tripAction(
        bookingId: widget.bookingId,
        action: action,
        location: {'lat': 43.65, 'lng': -79.38},
      );
      setState(() => notice = 'OK $action');
      if (action == 'COMPLETE' && mounted) {
        context.go('/earnings');
      }
    } catch (e) {
      setState(() => notice = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const actions = [
      'EN_ROUTE',
      'ARRIVED',
      'WAITING',
      'PASSENGER_ONBOARD',
      'IN_PROGRESS',
      'COMPLETE',
    ];
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            IconButton(
              alignment: Alignment.centerLeft,
              onPressed: () => context.go('/my-day'),
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            ),
            Text(widget.bookingId,
                style: const TextStyle(color: LuxColors.muted, fontWeight: FontWeight.w700)),
            const Text('Trip lifecycle',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            const Text('tripLifecycle callable — advance status in order',
                style: TextStyle(color: LuxColors.muted)),
            const SizedBox(height: 20),
            ...actions.map(
              (a) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: FilledButton(
                  onPressed: busy ? null : () => _run(a),
                  style: FilledButton.styleFrom(
                    backgroundColor: LuxColors.lime,
                    foregroundColor: LuxColors.ink,
                    minimumSize: const Size.fromHeight(48),
                  ),
                  child: Text(a, style: const TextStyle(fontWeight: FontWeight.w900)),
                ),
              ),
            ),
            if (notice != null) Text(notice!),
          ],
        ),
      ),
    );
  }
}
