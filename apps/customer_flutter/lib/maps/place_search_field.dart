import 'dart:async';

import 'package:flutter/material.dart';

import '../data/models.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../widgets/lux_chrome.dart';
import '../widgets/lux_text_field.dart';
import 'places_service.dart';

/// Searchable place picker — Places API when keyed, catalog filter otherwise.
class PlaceSearchField extends StatefulWidget {
  const PlaceSearchField({
    super.key,
    required this.label,
    required this.onSelected,
    this.hint = 'Search address or place',
  });

  final String label;
  final ValueChanged<Place> onSelected;
  final String hint;

  @override
  State<PlaceSearchField> createState() => _PlaceSearchFieldState();
}

class _PlaceSearchFieldState extends State<PlaceSearchField> {
  final _controller = TextEditingController();
  Timer? _debounce;
  bool _busy = false;
  String? _error;
  List<PlaceSuggestion> _results = const [];

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 320), () => _search(value));
  }

  Future<void> _search(String value) async {
    if (value.trim().length < 2) {
      setState(() {
        _results = const [];
        _error = null;
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final rows = await PlacesService.autocomplete(value);
      if (!mounted) return;
      setState(() => _results = rows);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pick(PlaceSuggestion s) async {
    setState(() => _busy = true);
    try {
      final place = await PlacesService.resolveSuggestion(s);
      _controller.text = place.label;
      setState(() => _results = const []);
      widget.onSelected(place);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LuxTextField(
          controller: _controller,
          label: widget.label,
          hint: widget.hint,
          prefixIcon: Icons.search,
          onChanged: _onChanged,
          suffixIcon: _busy
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : null,
        ),
        const SizedBox(height: 6),
        const Text(
          'Google Places search · catalog fallback if offline',
          style: LuxTypography.caption,
        ),
        if (_error != null) ...[
          const SizedBox(height: 6),
          Text(_error!, style: const TextStyle(color: LuxColors.danger, fontSize: 12)),
        ],
        if (_results.isNotEmpty) ...[
          const SizedBox(height: LuxSpacing.sm),
          LuxCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < _results.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  ListTile(
                    dense: true,
                    title: Text(
                      _results[i].label,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(_results[i].address),
                    onTap: () => _pick(_results[i]),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}
