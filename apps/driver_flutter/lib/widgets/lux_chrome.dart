import 'package:flutter/material.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';

class LuxPrimaryButton extends StatelessWidget {
  const LuxPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.enabled = true,
    this.loading = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool enabled;
  final bool loading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final child = loading
        ? const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2.4),
          )
        : Text(label);

    final btn = SizedBox(
      height: LuxSpacing.buttonHeight,
      width: expand ? double.infinity : null,
      child: FilledButton(
        onPressed: enabled && !loading ? onPressed : null,
        style: FilledButton.styleFrom(
          backgroundColor: LuxColors.lime,
          foregroundColor: LuxColors.ink,
          disabledBackgroundColor: LuxColors.disabledBg,
          disabledForegroundColor: LuxColors.disabledFg,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
          ),
          textStyle: LuxTypography.button,
        ),
        child: child,
      ),
    );
    return btn;
  }
}

class LuxSecondaryButton extends StatelessWidget {
  const LuxSecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.enabled = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: LuxSpacing.buttonHeight,
      child: OutlinedButton(
        onPressed: enabled ? onPressed : null,
        child: Text(label),
      ),
    );
  }
}

class LuxCard extends StatelessWidget {
  const LuxCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(LuxSpacing.cardPad),
    this.selected = false,
    this.color,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final bool selected;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final bg = color ??
        (selected ? LuxColors.lime.withValues(alpha: 0.28) : LuxColors.surface);
    final card = AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(LuxSpacing.radiusLg),
        border: Border.all(
          color: selected ? LuxColors.ink : LuxColors.line,
          width: selected ? 1.5 : 1,
        ),
      ),
      child: child,
    );
    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(LuxSpacing.radiusLg),
        child: card,
      ),
    );
  }
}

class LuxScreenHeader extends StatelessWidget {
  const LuxScreenHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.onBack,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onBack;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        LuxSpacing.xs,
        LuxSpacing.xs,
        LuxSpacing.screenH,
        LuxSpacing.sm,
      ),
      child: Row(
        children: [
          if (onBack != null)
            IconButton(
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            )
          else
            const SizedBox(width: LuxSpacing.screenH - LuxSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: LuxTypography.sectionTitle),
                if (subtitle != null)
                  Text(subtitle!, style: LuxTypography.caption),
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

class LuxStatusPill extends StatelessWidget {
  const LuxStatusPill({
    super.key,
    required this.label,
    this.color = LuxColors.info,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(LuxSpacing.radiusPill),
      ),
      child: Text(
        label,
        style: LuxTypography.status.copyWith(color: color),
      ),
    );
  }
}

class LuxEmptyState extends StatelessWidget {
  const LuxEmptyState({
    super.key,
    required this.title,
    this.body,
    this.icon = Icons.inbox_outlined,
    this.action,
  });

  final String title;
  final String? body;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(LuxSpacing.lg),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 48, color: LuxColors.mutedSoft),
          const SizedBox(height: LuxSpacing.md),
          Text(title, style: LuxTypography.cardTitle, textAlign: TextAlign.center),
          if (body != null) ...[
            const SizedBox(height: LuxSpacing.xs),
            Text(body!, style: LuxTypography.bodyMuted, textAlign: TextAlign.center),
          ],
          if (action != null) ...[
            const SizedBox(height: LuxSpacing.lg),
            action!,
          ],
        ],
      ),
    );
  }
}

class LuxSectionLabel extends StatelessWidget {
  const LuxSectionLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text, style: LuxTypography.label);
  }
}

class LuxGoogleButton extends StatelessWidget {
  const LuxGoogleButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: LuxSpacing.buttonHeight,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: const Icon(Icons.g_mobiledata_rounded, size: 28),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: LuxColors.ink,
          side: const BorderSide(color: LuxColors.lineStrong),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(LuxSpacing.radiusMd),
          ),
          textStyle: LuxTypography.button,
        ),
      ),
    );
  }
}
