import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;

import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import 'geo_math.dart';
import 'lux_map_args.dart';
import 'lux_map_config.dart';

/// Compact Google Maps route card. Tap to open the full-screen zoomable map.
class LuxRoutePreview extends StatefulWidget {
  const LuxRoutePreview({
    super.key,
    required this.pickup,
    required this.dropoff,
    this.pickupLabel,
    this.dropoffLabel,
    this.height = 200,
    this.openFullScreen = true,
  });

  final LatLng pickup;
  final LatLng dropoff;
  final String? pickupLabel;
  final String? dropoffLabel;
  final double height;
  final bool openFullScreen;

  @override
  State<LuxRoutePreview> createState() => _LuxRoutePreviewState();
}

class _LuxRoutePreviewState extends State<LuxRoutePreview> {
  gmaps.GoogleMapController? _controller;

  gmaps.LatLng get _pickup =>
      gmaps.LatLng(widget.pickup.lat, widget.pickup.lng);
  gmaps.LatLng get _dropoff =>
      gmaps.LatLng(widget.dropoff.lat, widget.dropoff.lng);

  bool get _samePoint =>
      (widget.pickup.lat - widget.dropoff.lat).abs() < 1e-7 &&
      (widget.pickup.lng - widget.dropoff.lng).abs() < 1e-7;

  Set<gmaps.Marker> get _markers => {
        gmaps.Marker(
          markerId: const gmaps.MarkerId('pickup'),
          position: _pickup,
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
            gmaps.BitmapDescriptor.hueYellow,
          ),
        ),
        if (!_samePoint)
          gmaps.Marker(
            markerId: const gmaps.MarkerId('dropoff'),
            position: _dropoff,
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
        width: 4,
      ),
    };
  }

  Future<void> _fit() async {
    final c = _controller;
    if (c == null) return;
    if (_samePoint) {
      await c.moveCamera(gmaps.CameraUpdate.newLatLngZoom(_pickup, 13));
      return;
    }
    final bounds = gmaps.LatLngBounds(
      southwest: gmaps.LatLng(
        math.min(widget.pickup.lat, widget.dropoff.lat),
        math.min(widget.pickup.lng, widget.dropoff.lng),
      ),
      northeast: gmaps.LatLng(
        math.max(widget.pickup.lat, widget.dropoff.lat),
        math.max(widget.pickup.lng, widget.dropoff.lng),
      ),
    );
    await c.moveCamera(gmaps.CameraUpdate.newLatLngBounds(bounds, 40));
  }

  void _openFull() {
    if (!widget.openFullScreen) return;
    final args = LuxMapArgs(
      pickup: widget.pickup,
      dropoff: widget.dropoff,
      pickupLabel: widget.pickupLabel,
      dropoffLabel: widget.dropoffLabel,
      title: 'Route map',
    );
    final q = Uri(queryParameters: args.toQuery()).query;
    context.push('/map?$q');
  }

  @override
  void didUpdateWidget(covariant LuxRoutePreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pickup.lat != widget.pickup.lat ||
        oldWidget.pickup.lng != widget.pickup.lng ||
        oldWidget.dropoff.lat != widget.dropoff.lat ||
        oldWidget.dropoff.lng != widget.dropoff.lng) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _fit());
    }
  }

  @override
  Widget build(BuildContext context) {
    final km = GeoMath.haversineKm(widget.pickup, widget.dropoff);
    final eta = GeoMath.etaMinutes(km);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusLg),
        onTap: _openFull,
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(LuxSpacing.radiusLg),
            border: Border.all(color: LuxColors.line),
            color: LuxColors.surface,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(LuxSpacing.radiusLg - 1),
                ),
                child: SizedBox(
                  height: widget.height,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      AbsorbPointer(
                        child: gmaps.GoogleMap(
                          initialCameraPosition: gmaps.CameraPosition(
                            target: _pickup,
                            zoom: 12,
                          ),
                          markers: _markers,
                          polylines: _polylines,
                          myLocationButtonEnabled: false,
                          compassEnabled: false,
                          mapToolbarEnabled: false,
                          zoomControlsEnabled: false,
                          zoomGesturesEnabled: false,
                          scrollGesturesEnabled: false,
                          rotateGesturesEnabled: false,
                          tiltGesturesEnabled: false,
                          liteModeEnabled: false,
                          onMapCreated: (controller) async {
                            _controller = controller;
                            await Future<void>.delayed(
                              const Duration(milliseconds: 120),
                            );
                            await _fit();
                          },
                        ),
                      ),
                      Positioned(
                        left: 10,
                        top: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: LuxColors.ink.withValues(alpha: 0.78),
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text(
                            LuxMapConfig.modeLabel,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        right: 10,
                        bottom: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color: LuxColors.surface.withValues(alpha: 0.95),
                            borderRadius: BorderRadius.circular(99),
                            border: Border.all(color: LuxColors.line),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.open_in_full_rounded, size: 14),
                              SizedBox(width: 6),
                              Text(
                                'Open map',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${widget.pickupLabel ?? 'Pickup'} → ${widget.dropoffLabel ?? 'Dropoff'}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '${km.toStringAsFixed(1)} km · ~$eta min',
                      style: LuxTypography.caption.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
