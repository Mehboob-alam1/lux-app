import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/driver_api.dart';
import '../theme/lux_colors.dart';

class MyDayScreen extends StatefulWidget {
  const MyDayScreen({super.key});

  @override
  State<MyDayScreen> createState() => _MyDayScreenState();
}

class _MyDayScreenState extends State<MyDayScreen> {
  bool online = false;
  bool busy = false;
  String? notice;

  Future<void> _toggle(bool value) async {
    setState(() {
      busy = true;
      notice = null;
    });
    try {
      final res = await DriverApi.instance.setOnline(value);
      setState(() {
        online = value;
        notice = res.toString();
      });
    } catch (e) {
      setState(() => notice = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final email = FirebaseAuth.instance.currentUser?.email ?? 'Driver';
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          children: [
            Text(email, style: const TextStyle(color: LuxColors.muted)),
            const Text('My Day',
                style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900)),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: LuxColors.surface,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: LuxColors.line),
              ),
              child: SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(online ? 'Online — eligible for offers' : 'Offline',
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: const Text('setDriverOnline callable'),
                value: online,
                onChanged: busy ? null : _toggle,
              ),
            ),
            if (notice != null) ...[
              const SizedBox(height: 10),
              Text(notice!, style: const TextStyle(fontSize: 12, color: LuxColors.muted)),
            ],
            const SizedBox(height: 16),
            StreamBuilder(
              stream: DriverApi.instance.watchAssignedBookings(),
              builder: (context, snap) {
                final rows = snap.data ?? const <Map<String, dynamic>>[];
                final active = rows.where((r) {
                  final s = r['currentStatus'] as String? ?? '';
                  return s != 'COMPLETED' && s != 'CANCELLED';
                }).toList();
                if (active.isEmpty) {
                  return OutlinedButton(
                    onPressed: () => context.go('/opportunities'),
                    child: const Text('View offers'),
                  );
                }
                final b = active.first;
                final id = b['bookingId'] as String;
                return FilledButton(
                  onPressed: () => context.push('/active-trip/$id'),
                  style: FilledButton.styleFrom(
                    backgroundColor: LuxColors.lime,
                    foregroundColor: LuxColors.ink,
                    minimumSize: const Size.fromHeight(52),
                  ),
                  child: Text('Active ${b['currentStatus']} · open',
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
