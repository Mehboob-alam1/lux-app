import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';

/// Premium text field with consistent validation / focus / helper UX.
class LuxTextField extends StatefulWidget {
  const LuxTextField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.helperText,
    this.errorText,
    this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.enableObscureToggle = false,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.inputFormatters,
    this.maxLength,
    this.maxLines = 1,
    this.minLines,
    this.enabled = true,
    this.readOnly = false,
    this.onChanged,
    this.onSubmitted,
    this.validator,
    this.focusNode,
    this.textCapitalization = TextCapitalization.none,
    this.autofocus = false,
  });

  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? helperText;
  final String? errorText;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final bool obscureText;
  final bool enableObscureToggle;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;
  final int? maxLines;
  final int? minLines;
  final bool enabled;
  final bool readOnly;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final FormFieldValidator<String>? validator;
  final FocusNode? focusNode;
  final TextCapitalization textCapitalization;
  final bool autofocus;

  @override
  State<LuxTextField> createState() => _LuxTextFieldState();
}

class _LuxTextFieldState extends State<LuxTextField> {
  late bool _obscured = widget.obscureText;

  @override
  void didUpdateWidget(covariant LuxTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.obscureText != widget.obscureText &&
        !widget.enableObscureToggle) {
      _obscured = widget.obscureText;
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget? suffix = widget.suffixIcon;
    if (widget.enableObscureToggle) {
      suffix = IconButton(
        tooltip: _obscured ? 'Show password' : 'Hide password',
        onPressed: () => setState(() => _obscured = !_obscured),
        icon: Icon(
          _obscured
              ? Icons.visibility_outlined
              : Icons.visibility_off_outlined,
          color: LuxColors.muted,
          size: LuxSpacing.iconMd,
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: LuxColors.textSecondary,
            ),
          ),
          const SizedBox(height: LuxSpacing.xs),
        ],
        TextFormField(
          controller: widget.controller,
          focusNode: widget.focusNode,
          obscureText: _obscured,
          enabled: widget.enabled,
          readOnly: widget.readOnly,
          autofocus: widget.autofocus,
          keyboardType: widget.keyboardType,
          textInputAction: widget.textInputAction,
          autofillHints: widget.autofillHints,
          inputFormatters: widget.inputFormatters,
          maxLength: widget.maxLength,
          maxLines: widget.obscureText || widget.enableObscureToggle
              ? 1
              : widget.maxLines,
          minLines: widget.minLines,
          textCapitalization: widget.textCapitalization,
          validator: widget.validator,
          autovalidateMode: AutovalidateMode.onUserInteraction,
          onChanged: widget.onChanged,
          onFieldSubmitted: widget.onSubmitted,
          style: const TextStyle(
            fontWeight: FontWeight.w600,
            color: LuxColors.textPrimary,
            fontSize: 16,
          ),
          decoration: InputDecoration(
            hintText: widget.hint,
            helperText: widget.errorText == null ? widget.helperText : null,
            errorText: widget.errorText,
            counterText: widget.maxLength == null ? '' : null,
            prefixIcon: widget.prefixIcon == null
                ? null
                : Icon(widget.prefixIcon, color: LuxColors.muted),
            suffixIcon: suffix,
          ),
        ),
      ],
    );
  }
}

/// Common validators — plain language, no technical jargon.
abstract final class LuxValidators {
  static String? required(String? v, [String label = 'This field']) {
    if (v == null || v.trim().isEmpty) return '$label is required.';
    return null;
  }

  static String? email(String? v) {
    final t = v?.trim() ?? '';
    if (t.isEmpty) return 'Enter your email address.';
    final ok = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(t);
    if (!ok) return 'Enter a valid email address.';
    return null;
  }

  static String? password(String? v, {int min = 6}) {
    if (v == null || v.isEmpty) return 'Enter a password.';
    if (v.length < min) return 'Password must be at least $min characters.';
    return null;
  }

  static String? name(String? v) {
    final t = v?.trim() ?? '';
    if (t.isEmpty) return 'Enter your name.';
    if (t.length < 2) return 'Name looks too short.';
    return null;
  }

  static String? phone(String? v) {
    final t = (v ?? '').replaceAll(RegExp(r'\s|-'), '');
    if (t.isEmpty) return null;
    if (t.length < 8) return 'Enter a valid phone number.';
    return null;
  }

  static String? positiveInt(String? v, {String label = 'Value', int min = 1}) {
    final n = int.tryParse(v?.trim() ?? '');
    if (n == null) return 'Enter a valid $label.';
    if (n < min) return '$label must be at least $min.';
    return null;
  }
}
