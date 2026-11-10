import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../services/driver_api.dart';
import '../services/location_service.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../utils/trip_guide.dart';
import '../widgets/lux_chrome.dart';
import '../widgets/lux_feedback.dart';

class MyDayScreen extends StatefulWidget {
  const MyDayScreen({super.key});

  @override
  State<MyDayScreen> createState() => _MyDayScreenState();
}

class _MyDayScreenState extends State<MyDayScreen> {
  bool _busy = false;
  DriverFix? _lastFix;

  Future<void> _toggle(bool value) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final fix = await LocationService.current();
      setState(() => _lastFix = fix);
      try {
        await DriverApi.instance.updateLocation(lat: fix.lat, lng: fix.lng);
      } catch (_) {}
      final res = await DriverApi.instance.setOnline(value);
      if (!mounted) return;
      final state = res['onlineState']?.toString() ?? (value ? 'ONLINE' : 'OFFLINE');
      LuxFeedback.success(
        context,
        'Now $state · ${fix.label ?? (fix.fromDevice ? 'GPS' : 'fallback')}',
      );
    } catch (e) {
      if (!mounted) return;
      LuxFeedback.error(context, e, fallback: DriverApi.instance.mapError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final name = user?.displayName?.trim().isNotEmpty == true
        ? user!.displayName!.trim()
        : (user?.email ?? 'Driver');

    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          children: [
            Text(name, style: LuxTypography.caption),
            Text('My Day', style: LuxTypography.display(context)),
            const SizedBox(height: 8),
            const Text(
              'Go online to receive offers. Location uses device GPS when permitted.',
              style: LuxTypography.bodyMuted,
            ),
            if (_lastFix != null) ...[
              const SizedBox(height: 8),
              Text(
                '${_lastFix!.label} · ${_lastFix!.lat.toStringAsFixed(5)}, ${_lastFix!.lng.toStringAsFixed(5)}',
                style: LuxTypography.caption,
              ),
            ],
            const SizedBox(height: LuxSpacing.lg),
            StreamBuilder<Map<String, dynamic>?>(
              stream: DriverApi.instance.watchMyDriver(),
              builder: (context, snap) {
                final driver = snap.data;
                final onlineState =
                    driver?['onlineState'] as String? ?? 'OFFLINE';
                final online = onlineState == 'ONLINE';
                final status = driver?['status'] as String? ?? 'UNKNOWN';
                return LuxCard(
                  color: online
                      ? LuxColors.lime.withValues(alpha: 0.4)
                      : LuxColors.surface,
                  child: Column(
                    children: [
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          online ? 'Online' : 'Offline',
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                        subtitle: Text(
                          online
                              ? 'Eligible for pending offers'
                              : 'You will not receive new offers',
                        ),
                        value: online,
                        activeThumbColor: LuxColors.ink,
                        activeTrackColor: LuxColors.lime,
                        onChanged: _busy ? null : _toggle,
                      ),
                      const Divider(height: 1),
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Row(
                          children: [
                            LuxStatusPill(
                              label: status,
                              color: status == 'ACTIVE'
                                  ? LuxColors.success
                                  : LuxColors.warning,
                            ),
                            const SizedBox(width: 8),
                            LuxStatusPill(
                              label: onlineState,
                              color: online
                                  ? LuxColors.driverOnline
                                  : LuxColors.driverOffline,
                            ),
                            if (_busy) ...[
                              const Spacer(),
                              const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: LuxSpacing.lg),
            const LuxSectionLabel('Active assignment'),
            const SizedBox(height: 10),
            StreamBuilder(
              stream: DriverApi.instance.watchAssignedBookings(),
              builder: (context, snap) {
                if (snap.hasError) {
                  return LuxCard(
                    child: Text(
                      DriverApi.instance.mapError(snap.error!),
                      style: const TextStyle(color: LuxColors.danger),
                    ),
                  );
                }
                final rows = snap.data ?? const <Map<String, dynamic>>[];
                final active = rows
                    .where((r) => TripGuide.isOpen(r['currentStatus'] as String?))
                    .toList();
                if (active.isEmpty) {
                  return LuxCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'No active trip',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Accept an offer to start a guided trip lifecycle.',
                          style: LuxTypography.bodyMuted,
                        ),
                        const SizedBox(height: 12),
                        LuxPrimaryButton(
                          label: 'View offers',
                          onPressed: () => context.go('/opportunities'),
                        ),
                      ],
                    ),
                  );
                }
                final b = active.first;
                final id = b['bookingId'] as String;
                final status = b['currentStatus'] as String? ?? '—';
                return LuxCard(
                  onTap: () => context.push('/active-trip/$id'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          LuxStatusPill(
                            label: TripGuide.label(status),
                            color: TripGuide.color(status),
                          ),
                          const Spacer(),
                          const Icon(Icons.chevron_right),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        id,
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${TripGuide.placeLabel(b, 'PICKUP') ?? 'Pickup'} → ${TripGuide.placeLabel(b, 'DROPOFF') ?? 'Dropoff'}',
                        style: LuxTypography.caption,
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
