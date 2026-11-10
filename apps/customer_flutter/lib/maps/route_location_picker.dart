import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;

import '../data/lux_catalog.dart';
import '../data/models.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../widgets/lux_chrome.dart';
import '../widgets/lux_text_field.dart';
import 'places_service.dart';

enum _PickMode { pickup, dropoff }

/// Map-first pickup / dropoff picker.
/// Tap the map (or search / quick chips) to set each pin.
class RouteLocationPicker extends StatefulWidget {
  const RouteLocationPicker({
    super.key,
    required this.pickup,
    required this.dropoff,
    required this.onPickupChanged,
    required this.onDropoffChanged,
  });

  final Place? pickup;
  final Place? dropoff;
  final ValueChanged<Place> onPickupChanged;
  final ValueChanged<Place> onDropoffChanged;

  @override
  State<RouteLocationPicker> createState() => _RouteLocationPickerState();
}

class _RouteLocationPickerState extends State<RouteLocationPicker> {
  gmaps.GoogleMapController? _map;
  _PickMode _mode = _PickMode.pickup;
  final _search = TextEditingController();
  Timer? _debounce;
  bool _searching = false;
  bool _locating = false;
  List<PlaceSuggestion> _results = const [];
  String? _searchError;

  static const _toronto = gmaps.LatLng(43.6532, -79.3832);

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant RouteLocationPicker oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pickup?.lat != widget.pickup?.lat ||
        oldWidget.pickup?.lng != widget.pickup?.lng ||
        oldWidget.dropoff?.lat != widget.dropoff?.lat ||
        oldWidget.dropoff?.lng != widget.dropoff?.lng) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _fit());
    }
  }

  Future<void> _fit() async {
    final c = _map;
    if (c == null) return;
    final p = widget.pickup;
    final d = widget.dropoff;
    if (p == null && d == null) {
      await c.animateCamera(gmaps.CameraUpdate.newLatLngZoom(_toronto, 12));
      return;
    }
    if (p != null && d == null) {
      await c.animateCamera(
        gmaps.CameraUpdate.newLatLngZoom(gmaps.LatLng(p.lat, p.lng), 14),
      );
      return;
    }
    if (d != null && p == null) {
      await c.animateCamera(
        gmaps.CameraUpdate.newLatLngZoom(gmaps.LatLng(d.lat, d.lng), 14),
      );
      return;
    }
    final bounds = gmaps.LatLngBounds(
      southwest: gmaps.LatLng(
        math.min(p!.lat, d!.lat),
        math.min(p.lng, d.lng),
      ),
      northeast: gmaps.LatLng(
        math.max(p.lat, d.lat),
        math.max(p.lng, d.lng),
      ),
    );
    await c.animateCamera(gmaps.CameraUpdate.newLatLngBounds(bounds, 72));
  }

  void _onMapTap(gmaps.LatLng pos) {
    final place = Place(
      label: _mode == _PickMode.pickup ? 'Pickup pin' : 'Dropoff pin',
      address:
          '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}',
      lat: pos.latitude,
      lng: pos.longitude,
    );
    if (_mode == _PickMode.pickup) {
      widget.onPickupChanged(place);
      // After setting pickup, nudge user to dropoff.
      if (widget.dropoff == null) {
        setState(() => _mode = _PickMode.dropoff);
      }
    } else {
      widget.onDropoffChanged(place);
      if (widget.pickup == null) {
        setState(() => _mode = _PickMode.pickup);
      }
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 280), () => _runSearch(value));
  }

  Future<void> _runSearch(String value) async {
    if (value.trim().length < 2) {
      setState(() {
        _results = const [];
        _searchError = null;
      });
      return;
    }
    setState(() {
      _searching = true;
      _searchError = null;
    });
    try {
      final rows = await PlacesService.autocomplete(value);
      if (!mounted) return;
      setState(() => _results = rows);
    } catch (e) {
      if (!mounted) return;
      setState(() => _searchError = e.toString());
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _pickSuggestion(PlaceSuggestion s) async {
    setState(() => _searching = true);
    try {
      final place = await PlacesService.resolveSuggestion(s);
      _search.clear();
      setState(() => _results = const []);
      if (_mode == _PickMode.pickup) {
        widget.onPickupChanged(place);
        if (widget.dropoff == null) setState(() => _mode = _PickMode.dropoff);
      } else {
        widget.onDropoffChanged(place);
        if (widget.pickup == null) setState(() => _mode = _PickMode.pickup);
      }
      await _map?.animateCamera(
        gmaps.CameraUpdate.newLatLngZoom(
          gmaps.LatLng(place.lat, place.lng),
          14.5,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _searchError = e.toString());
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  void _pickCatalog(Place place) {
    if (_mode == _PickMode.pickup) {
      widget.onPickupChanged(place);
      if (widget.dropoff == null) setState(() => _mode = _PickMode.dropoff);
    } else {
      widget.onDropoffChanged(place);
      if (widget.pickup == null) setState(() => _mode = _PickMode.pickup);
    }
    _map?.animateCamera(
      gmaps.CameraUpdate.newLatLngZoom(
        gmaps.LatLng(place.lat, place.lng),
        14.5,
      ),
    );
  }

  void _swap() {
    final p = widget.pickup;
    final d = widget.dropoff;
    if (p == null && d == null) return;
    if (d != null) widget.onPickupChanged(d);
    if (p != null) widget.onDropoffChanged(p);
  }

  Future<void> _useMyLocation() async {
    setState(() => _locating = true);
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Location permission is required')),
        );
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      final place = Place(
        label: 'Current location',
        address:
            '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}',
        lat: pos.latitude,
        lng: pos.longitude,
      );
      if (_mode == _PickMode.pickup) {
        widget.onPickupChanged(place);
        if (widget.dropoff == null) setState(() => _mode = _PickMode.dropoff);
      } else {
        widget.onDropoffChanged(place);
      }
      await _map?.animateCamera(
        gmaps.CameraUpdate.newLatLngZoom(
          gmaps.LatLng(pos.latitude, pos.longitude),
          15,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not get location: $e')),
      );
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Set<gmaps.Marker> get _markers {
    final out = <gmaps.Marker>{};
    final p = widget.pickup;
    final d = widget.dropoff;
    if (p != null) {
      out.add(
        gmaps.Marker(
          markerId: const gmaps.MarkerId('pickup'),
          position: gmaps.LatLng(p.lat, p.lng),
          infoWindow: gmaps.InfoWindow(title: 'Pickup', snippet: p.label),
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
            gmaps.BitmapDescriptor.hueYellow,
          ),
          draggable: true,
          onDragEnd: (pos) => widget.onPickupChanged(
            Place(
              label: p.label,
              address:
                  '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}',
              lat: pos.latitude,
              lng: pos.longitude,
            ),
          ),
        ),
      );
    }
    if (d != null) {
      out.add(
        gmaps.Marker(
          markerId: const gmaps.MarkerId('dropoff'),
          position: gmaps.LatLng(d.lat, d.lng),
          infoWindow: gmaps.InfoWindow(title: 'Dropoff', snippet: d.label),
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(
            gmaps.BitmapDescriptor.hueAzure,
          ),
          draggable: true,
          onDragEnd: (pos) => widget.onDropoffChanged(
            Place(
              label: d.label,
              address:
                  '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}',
              lat: pos.latitude,
              lng: pos.longitude,
            ),
          ),
        ),
      );
    }
    return out;
  }

  Set<gmaps.Polyline> get _polylines {
    final p = widget.pickup;
    final d = widget.dropoff;
    if (p == null || d == null) return {};
    return {
      gmaps.Polyline(
        polylineId: const gmaps.PolylineId('route'),
        points: [
          gmaps.LatLng(p.lat, p.lng),
          gmaps.LatLng(d.lat, d.lng),
        ],
        color: LuxColors.ink,
        width: 4,
      ),
    };
  }

  List<Place> get _quickPlaces => _mode == _PickMode.pickup
      ? LuxCatalog.pickupSuggestions
      : LuxCatalog.dropoffSuggestions;

  @override
  Widget build(BuildContext context) {
    final hint = _mode == _PickMode.pickup
        ? 'Tap the map to set pickup'
        : 'Tap the map to set dropoff';

    return Column(
      children: [
        Expanded(
          child: Stack(
            fit: StackFit.expand,
            children: [
              gmaps.GoogleMap(
                initialCameraPosition: const gmaps.CameraPosition(
                  target: _toronto,
                  zoom: 12,
                ),
                markers: _markers,
                polylines: _polylines,
                myLocationEnabled: true,
                myLocationButtonEnabled: false,
                zoomControlsEnabled: false,
                mapToolbarEnabled: false,
                compassEnabled: false,
                onMapCreated: (c) async {
                  _map = c;
                  await Future<void>.delayed(const Duration(milliseconds: 160));
                  await _fit();
                },
                onTap: _onMapTap,
              ),
              Positioned(
                top: 12,
                left: 12,
                right: 12,
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: LuxColors.surface.withValues(alpha: 0.96),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 14,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: _ModeChip(
                              label: 'Pickup',
                              selected: _mode == _PickMode.pickup,
                              onTap: () =>
                                  setState(() => _mode = _PickMode.pickup),
                            ),
                          ),
                          Expanded(
                            child: _ModeChip(
                              label: 'Dropoff',
                              selected: _mode == _PickMode.dropoff,
                              onTap: () =>
                                  setState(() => _mode = _PickMode.dropoff),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: LuxColors.ink.withValues(alpha: 0.82),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        hint,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                right: 12,
                bottom: 12,
                child: Column(
                  children: [
                    _MapFab(
                      icon: Icons.my_location_rounded,
                      loading: _locating,
                      onTap: _useMyLocation,
                    ),
                    const SizedBox(height: 8),
                    _MapFab(
                      icon: Icons.fit_screen_rounded,
                      onTap: _fit,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Material(
          color: LuxColors.surface,
          elevation: 12,
          shadowColor: Colors.black26,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _StopRow(
                          tone: LuxColors.lime,
                          title: 'Pickup',
                          subtitle: widget.pickup?.label ?? 'Tap map or search',
                          detail: widget.pickup?.address,
                          active: _mode == _PickMode.pickup,
                          onTap: () =>
                              setState(() => _mode = _PickMode.pickup),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Swap',
                        onPressed: _swap,
                        icon: const Icon(Icons.swap_vert_rounded),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _StopRow(
                    tone: LuxColors.ink,
                    title: 'Dropoff',
                    subtitle: widget.dropoff?.label ?? 'Tap map or search',
                    detail: widget.dropoff?.address,
                    active: _mode == _PickMode.dropoff,
                    onTap: () => setState(() => _mode = _PickMode.dropoff),
                  ),
                  const SizedBox(height: 12),
                  LuxTextField(
                    controller: _search,
                    label: _mode == _PickMode.pickup
                        ? 'Search pickup'
                        : 'Search dropoff',
                    hint: 'Address, airport, hotel…',
                    prefixIcon: Icons.search_rounded,
                    onChanged: (v) {
                      setState(() {});
                      _onSearchChanged(v);
                    },
                    suffixIcon: _searching
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : (_search.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.close_rounded),
                                onPressed: () {
                                  _search.clear();
                                  setState(() => _results = const []);
                                },
                              )
                            : null),
                  ),
                  if (_searchError != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      _searchError!,
                      style: const TextStyle(
                        color: LuxColors.danger,
                        fontSize: 12,
                      ),
                    ),
                  ],
                  if (_results.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 140),
                      child: LuxCard(
                        padding: EdgeInsets.zero,
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: _results.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final s = _results[i];
                            return ListTile(
                              dense: true,
                              leading: const Icon(Icons.place_outlined),
                              title: Text(
                                s.label,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              subtitle: Text(
                                s.address,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              onTap: () => _pickSuggestion(s),
                            );
                          },
                        ),
                      ),
                    ),
                  ] else ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 40,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _quickPlaces.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (context, i) {
                          final p = _quickPlaces[i];
                          final selected = _mode == _PickMode.pickup
                              ? widget.pickup?.label == p.label
                              : widget.dropoff?.label == p.label;
                          return ChoiceChip(
                            label: Text(p.label),
                            selected: selected,
                            onSelected: (_) => _pickCatalog(p),
                            selectedColor: LuxColors.lime.withValues(alpha: 0.55),
                            labelStyle: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? LuxColors.ink : Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: selected ? LuxColors.lime : LuxColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

class _MapFab extends StatelessWidget {
  const _MapFab({
    required this.icon,
    required this.onTap,
    this.loading = false,
  });
  final IconData icon;
  final VoidCallback onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: LuxColors.surface,
      shape: const CircleBorder(),
      elevation: 3,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: loading ? null : onTap,
        child: SizedBox(
          width: 46,
          height: 46,
          child: Center(
            child: loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(icon, color: LuxColors.ink),
          ),
        ),
      ),
    );
  }
}

class _StopRow extends StatelessWidget {
  const _StopRow({
    required this.tone,
    required this.title,
    required this.subtitle,
    required this.active,
    required this.onTap,
    this.detail,
  });

  final Color tone;
  final String title;
  final String subtitle;
  final String? detail;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active
          ? LuxColors.lime.withValues(alpha: 0.22)
          : LuxColors.surfaceMuted,
      borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
      child: InkWell(
        borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: tone,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: LuxColors.muted,
                      ),
                    ),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    if (detail != null && detail!.isNotEmpty)
                      Text(
                        detail!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: LuxTypography.caption,
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
