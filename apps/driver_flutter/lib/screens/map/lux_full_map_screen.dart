import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;

import '../../maps/geo_math.dart';
import '../../maps/lux_map_args.dart';
import '../../maps/lux_map_config.dart';
import '../../services/remote_config_service.dart';
import '../../theme/lux_colors.dart';
import '../../theme/lux_typography.dart';

/// Full-screen zoomable Google Map with pickup/dropoff pins + route line.
class LuxFullMapScreen extends StatefulWidget {
  const LuxFullMapScreen({super.key, required this.args});

  final LuxMapArgs args;

  @override
  State<LuxFullMapScreen> createState() => _LuxFullMapScreenState();
}

class _LuxFullMapScreenState extends State<LuxFullMapScreen> {
  gmaps.GoogleMapController? _controller;
  bool _mapReady = false;
  gmaps.MapType _mapType = gmaps.MapType.normal;

  gmaps.LatLng get _pickup =>
      gmaps.LatLng(widget.args.pickup.lat, widget.args.pickup.lng);
  gmaps.LatLng get _dropoff =>
      gmaps.LatLng(widget.args.dropoff.lat, widget.args.dropoff.lng);

  bool get _samePoint =>
      (widget.args.pickup.lat - widget.args.dropoff.lat).abs() < 1e-7 &&
      (widget.args.pickup.lng - widget.args.dropoff.lng).abs() < 1e-7;

  Set<gmaps.Marker> get _markers => {
        gmaps.Marker(
          markerId: const gmaps.MarkerId('pickup'),
          position: _pickup,
          infoWindow: gmaps.InfoWindow(
            title: widget.args.pickupLabel ?? 'Pickup',
          ),
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
            gmaps.BitmapDescriptor.hueYellow,
          ),
        ),
        if (!_samePoint)
          gmaps.Marker(
            markerId: const gmaps.MarkerId('dropoff'),
            position: _dropoff,
            infoWindow: gmaps.InfoWindow(
              title: widget.args.dropoffLabel ?? 'Dropoff',
            ),
            icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
              gmaps.BitmapDescriptor.hueAzure,
            ),
          ),
      };

  Set<gmaps.Polyline> get _polylines {
    if (_samePoint) return {};
    return {
      gmaps.Polyline(
        polylineId: const gmaps.PolylineId('route'),
        points: [_pickup, _dropoff],
        color: LuxColors.ink,
        width: 5,
      ),
    };
  }

  Future<void> _fit({bool animated = true}) async {
    final c = _controller;
    if (c == null) return;
    if (_samePoint) {
      final update = gmaps.CameraUpdate.newLatLngZoom(_pickup, 14);
      if (animated) {
        await c.animateCamera(update);
      } else {
        await c.moveCamera(update);
      }
      return;
    }
    final bounds = gmaps.LatLngBounds(
      southwest: gmaps.LatLng(
        math.min(widget.args.pickup.lat, widget.args.dropoff.lat),
        math.min(widget.args.pickup.lng, widget.args.dropoff.lng),
      ),
      northeast: gmaps.LatLng(
        math.max(widget.args.pickup.lat, widget.args.dropoff.lat),
        math.max(widget.args.pickup.lng, widget.args.dropoff.lng),
      ),
    );
    final update = gmaps.CameraUpdate.newLatLngBounds(bounds, 72);
    if (animated) {
      await c.animateCamera(update);
    } else {
      await c.moveCamera(update);
    }
  }

  Future<void> _zoomBy(double delta) async {
    final c = _controller;
    if (c == null) return;
    await c.animateCamera(gmaps.CameraUpdate.zoomBy(delta));
  }

  @override
  void initState() {
    super.initState();
    // Refresh Remote Config key before map tiles if needed.
    RemoteConfigService.refresh();
  }

  @override
  Widget build(BuildContext context) {
    final km = GeoMath.haversineKm(widget.args.pickup, widget.args.dropoff);
    final eta = GeoMath.etaMinutes(km);

    return Scaffold(
      backgroundColor: LuxColors.ink,
      body: Stack(
        fit: StackFit.expand,
        children: [
          gmaps.GoogleMap(
            initialCameraPosition: gmaps.CameraPosition(
              target: _pickup,
              zoom: 12,
            ),
            markers: _markers,
            polylines: _polylines,
            mapType: _mapType,
            myLocationButtonEnabled: false,
            compassEnabled: true,
            mapToolbarEnabled: false,
            zoomControlsEnabled: false,
            zoomGesturesEnabled: true,
            scrollGesturesEnabled: true,
            rotateGesturesEnabled: true,
            tiltGesturesEnabled: true,
            liteModeEnabled: false,
            onMapCreated: (controller) async {
              _controller = controller;
              await Future<void>.delayed(const Duration(milliseconds: 180));
              await _fit(animated: false);
              if (mounted) setState(() => _mapReady = true);
            },
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Column(
                children: [
                  Row(
                    children: [
                      _RoundIconButton(
                        icon: Icons.arrow_back_rounded,
                        onTap: () => context.canPop()
                            ? context.pop()
                            : context.go('/my-day'),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: LuxColors.surface.withValues(alpha: 0.96),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.12),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.args.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${widget.args.pickupLabel ?? 'Pickup'} → ${widget.args.dropoffLabel ?? 'Dropoff'}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: LuxTypography.bodyMuted
                                    .copyWith(fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Align(
                    alignment: Alignment.centerRight,
                    child: Column(
                      children: [
                        _RoundIconButton(
                          icon: Icons.add_rounded,
                          onTap: () => _zoomBy(1),
                        ),
                        const SizedBox(height: 8),
                        _RoundIconButton(
                          icon: Icons.remove_rounded,
                          onTap: () => _zoomBy(-1),
                        ),
                        const SizedBox(height: 8),
                        _RoundIconButton(
                          icon: Icons.center_focus_strong_rounded,
                          onTap: () => _fit(),
                        ),
                        const SizedBox(height: 8),
                        _RoundIconButton(
                          icon: _mapType == gmaps.MapType.normal
                              ? Icons.layers_outlined
                              : Icons.map_outlined,
                          onTap: () => setState(() {
                            _mapType = _mapType == gmaps.MapType.normal
                                ? gmaps.MapType.hybrid
                                : gmaps.MapType.normal;
                          }),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                    decoration: BoxDecoration(
                      color: LuxColors.surface.withValues(alpha: 0.97),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.16),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: LuxColors.lime.withValues(alpha: 0.55),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(Icons.route_rounded),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _samePoint
                                    ? 'Pin location'
                                    : '${km.toStringAsFixed(1)} km · ~$eta min',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                ),
                              ),
                              Text(
                                _mapReady
                                    ? 'Pinch to zoom · drag to pan · ${LuxMapConfig.modeLabel}'
                                    : 'Loading Google Maps…',
                                style: LuxTypography.bodyMuted
                                    .copyWith(fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: LuxColors.surface.withValues(alpha: 0.96),
      shape: const CircleBorder(),
      elevation: 3,
      shadowColor: Colors.black26,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 46,
          height: 46,
          child: Icon(icon, color: LuxColors.ink),
        ),
      ),
    );
  }
}
