import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../domain/models.dart';
import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import 'illustrations.dart';
import 'motion.dart';

// ── Fill / risk helpers ───────────────────────────────────────────────────────

Color fillColor(String? level) {
  switch ((level ?? '').toLowerCase()) {
    case 'empty':
      return AppColors.fillEmpty;
    case 'half':
      return AppColors.fillHalf;
    case 'overflow':
      return AppColors.fillOverflow;
    default:
      return AppColors.fillUnknown;
  }
}

String fillLabel(String? level) {
  switch ((level ?? '').toLowerCase()) {
    case 'empty':
      return 'Empty';
    case 'half':
      return 'Half full';
    case 'overflow':
      return 'Full';
    default:
      return 'No data';
  }
}

IconData fillIcon(String? level) {
  switch ((level ?? '').toLowerCase()) {
    case 'empty':
      return Icons.check_circle_rounded;
    case 'half':
      return Icons.timelapse_rounded;
    case 'overflow':
      return Icons.warning_rounded;
    default:
      return Icons.help_outline_rounded;
  }
}

double fillFraction(String? level, double? pct) {
  if (pct != null) return (pct.clamp(0, 100)) / 100;
  switch ((level ?? '').toLowerCase()) {
    case 'empty':
      return 0.18;
    case 'half':
      return 0.55;
    case 'overflow':
      return 1.0;
    default:
      return 0.0;
  }
}

/// Fill percentage to show for a bin (estimated from the tier when the model
/// did not return a percentage).
int fillPercentOf(String? level, double? pct) =>
    (fillFraction(level, pct) * 100).round();

Color riskColor(String? level) {
  switch ((level ?? '').toUpperCase()) {
    case 'LOW':
      return AppColors.riskLow;
    case 'MEDIUM':
      return AppColors.riskMedium;
    case 'HIGH':
      return AppColors.riskHigh;
    case 'CRITICAL':
      return AppColors.riskCritical;
    default:
      return AppColors.textSecondary;
  }
}

String fillShort(String? level) {
  switch ((level ?? '').toLowerCase()) {
    case 'empty':
      return 'E';
    case 'half':
      return 'H';
    case 'overflow':
      return 'F';
    default:
      return '?';
  }
}

String formatDistance(double? meters) {
  if (meters == null || !meters.isFinite) return '—';
  if (meters < 1000) return '${meters.round()} m';
  return '${(meters / 1000).toStringAsFixed(1)} km';
}

const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

String formatTs(String? iso) {
  if (iso == null || iso.isEmpty) return '—';
  try {
    final t = DateTime.parse(iso).toLocal();
    final hh = t.hour.toString().padLeft(2, '0');
    final mm = t.minute.toString().padLeft(2, '0');
    return '${t.day} ${_months[t.month - 1]} ${t.year}, $hh:$mm';
  } catch (_) {
    return iso;
  }
}

String formatClock(DateTime t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

String timeAgo(String? iso) {
  if (iso == null || iso.isEmpty) return 'No data yet';
  try {
    final t = DateTime.parse(iso).toLocal();
    final diff = DateTime.now().difference(t);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} h ago';
    if (diff.inDays < 7) return '${diff.inDays} d ago';
    return '${t.day} ${_months[t.month - 1]}';
  } catch (_) {
    return iso;
  }
}

String binCode(int id) => 'BIN-${id.toString().padLeft(3, '0')}';

String titleCase(String s) => s.isEmpty
    ? s
    : s
        .split(RegExp(r'[\s_]+'))
        .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1))
        .join(' ');

// ── Images ────────────────────────────────────────────────────────────────────

/// Network image that sends the staff token to our backend (capture photos
/// are protected), shows a shimmer while loading and [fallback] on failure.
class AppNetworkImage extends StatelessWidget {
  final String? url;
  final BoxFit fit;
  final Widget? fallback;

  const AppNetworkImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.fallback,
  });

  @override
  Widget build(BuildContext context) {
    final fb = fallback ?? const _PhotoFallback();
    if (url == null || url!.isEmpty) return fb;
    return CachedNetworkImage(
      imageUrl: url!,
      httpHeaders: ApiClient.instance.imageHeadersFor(url!),
      fit: fit,
      fadeInDuration: Motion.medium,
      placeholder: (_, __) => const SkeletonBox(radius: 0),
      errorWidget: (_, __, ___) => fb,
    );
  }
}

class _PhotoFallback extends StatelessWidget {
  const _PhotoFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: AppGradients.forest),
      alignment: Alignment.center,
      child: Icon(
        Icons.photo_camera_outlined,
        color: Colors.white.withValues(alpha: 0.35),
        size: 32,
      ),
    );
  }
}

class LastCapturePhoto extends StatelessWidget {
  final String? imageUrl;
  final double height;
  final double? width;
  final BorderRadius borderRadius;
  final String? capturedAt;
  final bool showHeader;

  const LastCapturePhoto({
    super.key,
    required this.imageUrl,
    this.height = 180,
    this.width,
    this.borderRadius = const BorderRadius.all(Radius.circular(18)),
    this.capturedAt,
    this.showHeader = true,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl == null || imageUrl!.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showHeader) ...[
          const SectionTitle('Last capture'),
          const SizedBox(height: 10),
        ],
        ClipRRect(
          borderRadius: borderRadius,
          child: SizedBox(
            height: height,
            width: width ?? double.infinity,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppNetworkImage(url: imageUrl),
                if (capturedAt != null)
                  Positioned(
                    left: 10,
                    bottom: 10,
                    child: GlassChip(
                      icon: Icons.schedule_rounded,
                      label: timeAgo(capturedAt),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class LastCaptureThumbnail extends StatelessWidget {
  final String? imageUrl;
  final double size;
  final BorderRadius borderRadius;
  final Widget fallback;

  const LastCaptureThumbnail({
    super.key,
    required this.imageUrl,
    this.size = 52,
    this.borderRadius = const BorderRadius.all(Radius.circular(16)),
    required this.fallback,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl == null || imageUrl!.isEmpty) return fallback;
    return ClipRRect(
      borderRadius: borderRadius,
      child: SizedBox(
        width: size,
        height: size,
        child: AppNetworkImage(url: imageUrl, fallback: fallback),
      ),
    );
  }
}

/// Banner card ("Cleaner City, Better Tomorrow") — uses the promo image set
/// from the web dashboard when available.
class PromoFooterCard extends StatelessWidget {
  final String? imageUrl;
  final double height;

  const PromoFooterCard({super.key, required this.imageUrl, this.height = 150});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: SizedBox(
        height: height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (imageUrl != null && imageUrl!.isNotEmpty)
              AppNetworkImage(
                url: imageUrl,
                fallback: const CityScene(showBins: false),
              )
            else
              const CityScene(showBins: false),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [
                    AppColors.background.withValues(alpha: 0.85),
                    AppColors.background.withValues(alpha: 0.1),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  const GlassChip(icon: Icons.eco_rounded, label: 'Our mission'),
                  const SizedBox(height: 10),
                  RichText(
                    text: const TextSpan(
                      style: TextStyle(
                        fontFamily: 'Poppins',
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        height: 1.2,
                        color: Colors.white,
                      ),
                      children: [
                        TextSpan(text: 'Cleaner city,\n'),
                        TextSpan(
                          text: 'better tomorrow',
                          style: TextStyle(color: AppColors.brandGlow),
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
    );
  }
}

// ── Layout primitives ─────────────────────────────────────────────────────────

class StaffCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? tint;
  final double radius;

  const StaffCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.tint,
    this.radius = 22,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: AppColors.glassCard(tint: tint, radius: radius),
      child: child,
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  const SectionTitle(this.text, {super.key, this.actionLabel, this.onAction});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(text, style: AppText.h2)),
        if (actionLabel != null)
          GestureDetector(
            onTap: onAction,
            child: Row(
              children: [
                Text(
                  actionLabel!,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.brandGlow,
                  ),
                ),
                const Icon(Icons.chevron_right_rounded,
                    size: 18, color: AppColors.brandGlow),
              ],
            ),
          ),
      ],
    );
  }
}

/// Small translucent pill with an icon (on top of photos/maps).
class GlassChip extends StatelessWidget {
  final IconData? icon;
  final String label;
  final Color? color;

  const GlassChip({super.key, this.icon, required this.label, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? Colors.white;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: c),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: c,
            ),
          ),
        ],
      ),
    );
  }
}

/// Coloured status pill ("Full", "HIGH", "Open"…).
class StatusPill extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;
  final bool solid;

  const StatusPill({
    super.key,
    required this.label,
    required this.color,
    this.icon,
    this.solid = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: solid ? color : color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(100),
        border: solid ? null : Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: solid ? Colors.white : color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: solid ? Colors.white : color,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// Rounded square with a soft tint and an icon.
class IconTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;
  final Gradient? gradient;

  const IconTile({
    super.key,
    required this.icon,
    required this.color,
    this.size = 44,
    this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: gradient == null ? color.withValues(alpha: 0.15) : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(size * 0.32),
      ),
      child: Icon(
        icon,
        color: gradient == null ? color : Colors.white,
        size: size * 0.5,
      ),
    );
  }
}

class EmptyHint extends StatelessWidget {
  final String message;
  final IconData icon;
  final String? title;

  const EmptyHint({
    super.key,
    required this.message,
    this.icon = Icons.inbox_rounded,
    this.title,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          IllustrationBadge(icon: icon, size: 64),
          if (title != null) ...[
            const SizedBox(height: 4),
            Text(title!, style: AppText.title, textAlign: TextAlign.center),
          ],
          const SizedBox(height: 6),
          Text(message, textAlign: TextAlign.center, style: AppText.body),
        ],
      ),
    ).animate().fadeIn(duration: Motion.medium);
  }
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

class KpiStatCard extends StatelessWidget {
  final String label;
  final num value;
  final String suffix;
  final Gradient gradient;
  final IconData icon;
  final double width;
  final VoidCallback? onTap;

  const KpiStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.gradient,
    required this.icon,
    this.suffix = '',
    this.width = 150,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      child: Container(
        width: width,
        padding: const EdgeInsets.all(16),
        decoration: AppColors.gradientCard(gradient),
        child: Stack(
          children: [
            Positioned(
              right: -18,
              top: -18,
              child: Icon(
                icon,
                size: 86,
                color: Colors.white.withValues(alpha: 0.12),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: Colors.white, size: 20),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AnimatedCount(
                      value: value,
                      suffix: suffix,
                      style: AppText.number.copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: 0.88),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class SummaryMiniCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData? icon;
  final Color? accent;

  const SummaryMiniCard({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final color = accent ?? AppColors.brand;
    return StaffCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      radius: 18,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            IconTile(icon: icon!, color: color, size: 32),
            const SizedBox(height: 10),
          ],
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.caption,
          ),
        ],
      ),
    );
  }
}

// ── Filters ───────────────────────────────────────────────────────────────────

class SegmentedFilterRow extends StatelessWidget {
  final List<(String, String)> options;
  final String selected;
  final ValueChanged<String> onSelected;
  final Map<String, Color>? accentById;
  final Map<String, int>? countById;

  const SegmentedFilterRow({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
    this.accentById,
    this.countById,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          for (final (id, label) in options)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilterPill(
                label: label,
                count: countById?[id],
                selected: selected == id,
                onTap: () => onSelected(id),
                activeColor: accentById?[id],
              ),
            ),
        ],
      ),
    );
  }
}

class FilterPill extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? count;
  final Color? activeColor;

  const FilterPill({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.count,
    this.activeColor,
  });

  @override
  Widget build(BuildContext context) {
    final accent = activeColor ?? AppColors.brand;
    return Pressable(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.medium,
        curve: Motion.curve,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(100),
          color: selected ? accent : AppColors.surfaceElevated,
          border: Border.all(
            color: selected
                ? accent
                : Colors.white.withValues(alpha: 0.06),
          ),
          boxShadow: selected ? AppShadows.glow(accent, strength: 0.3) : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : AppColors.textSecondary,
              ),
            ),
            if (count != null) ...[
              const SizedBox(width: 6),
              AnimatedContainer(
                duration: Motion.medium,
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                decoration: BoxDecoration(
                  color: selected
                      ? Colors.white.withValues(alpha: 0.25)
                      : accent.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: selected ? Colors.white : accent,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Bin list card ─────────────────────────────────────────────────────────────

class PriorityBinTile extends StatelessWidget {
  final Bin bin;
  final VoidCallback? onTap;
  final String? trailingNote;

  const PriorityBinTile({
    super.key,
    required this.bin,
    this.onTap,
    this.trailingNote,
  });

  @override
  Widget build(BuildContext context) {
    final color = fillColor(bin.latestFillLevel);
    final frac = fillFraction(bin.latestFillLevel, bin.latestFillPercentage);
    final pct = (frac * 100).round();

    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: AppColors.glassCard(radius: 22),
        child: Row(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                LastCaptureThumbnail(
                  imageUrl: bin.latestImageUrl,
                  size: 58,
                  fallback: IconTile(
                    icon: Icons.delete_outline_rounded,
                    color: color,
                    size: 58,
                  ),
                ),
                Positioned(
                  right: -4,
                  bottom: -4,
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.surface, width: 3),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(binCode(bin.id), style: AppText.title),
                      const SizedBox(width: 8),
                      if (bin.latestRiskLevel != null &&
                          bin.latestRiskLevel!.toUpperCase() != 'LOW')
                        StatusPill(
                          label: bin.latestRiskLevel!.toUpperCase(),
                          color: riskColor(bin.latestRiskLevel),
                        ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    bin.address ?? bin.location ?? bin.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.caption.copyWith(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 10),
                  AnimatedFillBar(fraction: frac, color: color, height: 6),
                ],
              ),
            ),
            const SizedBox(width: 14),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  bin.latestFillLevel == null ? '—' : '$pct%',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  trailingNote ?? timeAgo(bin.latestCapturedAt),
                  style: AppText.caption,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Horizontal fill bar that animates from 0 to [fraction].
class AnimatedFillBar extends StatelessWidget {
  final double fraction;
  final Color color;
  final double height;

  const AnimatedFillBar({
    super.key,
    required this.fraction,
    required this.color,
    this.height = 8,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: Container(
        height: height,
        color: Colors.white.withValues(alpha: 0.06),
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: fraction.clamp(0.0, 1.0)),
          duration: const Duration(milliseconds: 1100),
          curve: Curves.easeOutCubic,
          builder: (_, v, __) => FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: v,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(height),
                gradient: LinearGradient(
                  colors: [color.withValues(alpha: 0.7), color],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Alerts ────────────────────────────────────────────────────────────────────

Color alertColor(String severity) {
  switch (severity) {
    case 'critical':
      return AppColors.riskHigh;
    case 'warning':
      return AppColors.riskMedium;
    default:
      return AppColors.accentBlue;
  }
}

IconData alertIcon(StaffAlert alert) {
  final t = alert.title.toLowerCase();
  if (t.contains('animal')) return Icons.pets_rounded;
  if (t.contains('litter')) return Icons.report_rounded;
  if (t.contains('overflow') || t.contains('full') || t.contains('fill')) {
    return Icons.delete_sweep_rounded;
  }
  if (t.contains('risk') || t.contains('hygien')) {
    return Icons.health_and_safety_rounded;
  }
  switch (alert.severity) {
    case 'critical':
      return Icons.error_rounded;
    case 'warning':
      return Icons.warning_amber_rounded;
    default:
      return Icons.info_rounded;
  }
}

String alertStatusLabel(String status) {
  switch (status) {
    case 'acknowledged':
      return 'Seen';
    case 'actioned':
      return 'Resolved';
    case 'dismissed':
      return 'Dismissed';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Open';
  }
}

class AlertFeedTile extends StatelessWidget {
  final StaffAlert alert;
  final VoidCallback? onTap;

  const AlertFeedTile({super.key, required this.alert, this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = alertColor(alert.severity);
    final open = alert.status == 'open';
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: AppColors.glassCard(radius: 22),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            IconTile(icon: alertIcon(alert), color: color, size: 46),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          alert.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.title.copyWith(
                            color: open
                                ? AppColors.textPrimary
                                : AppColors.textSecondary,
                          ),
                        ),
                      ),
                      if (open) ...[
                        const SizedBox(width: 8),
                        LiveDot(color: color),
                      ],
                    ],
                  ),
                  if (alert.summary != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      alert.summary!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body.copyWith(fontSize: 12),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      StatusPill(
                        label: alertStatusLabel(alert.status),
                        color: open ? color : AppColors.textMuted,
                      ),
                      if (alert.deviceId != null)
                        StatusPill(
                          label: alert.deviceName ?? binCode(alert.deviceId!),
                          color: AppColors.textSecondary,
                          icon: Icons.delete_outline_rounded,
                        ),
                      Text(timeAgo(alert.createdAt), style: AppText.caption),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Route stop (timeline) ─────────────────────────────────────────────────────

class RouteStopTile extends StatelessWidget {
  final CollectionStop stop;
  final VoidCallback? onTap;
  final bool isFirst;
  final bool isLast;

  const RouteStopTile({
    super.key,
    required this.stop,
    this.onTap,
    this.isFirst = false,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = fillColor(stop.latestFillLevel);
    final pct = fillPercentOf(stop.latestFillLevel, stop.latestFillPercentage);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 36,
            child: Column(
              children: [
                Expanded(
                  child: Container(
                    width: 2,
                    color: isFirst
                        ? Colors.transparent
                        : AppColors.brand.withValues(alpha: 0.35),
                  ),
                ),
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    gradient: AppGradients.forFill(stop.latestFillLevel),
                    shape: BoxShape.circle,
                    boxShadow: AppShadows.glow(color, strength: 0.35),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${stop.order}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
                Expanded(
                  child: Container(
                    width: 2,
                    color: isLast
                        ? Colors.transparent
                        : AppColors.brand.withValues(alpha: 0.35),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Pressable(
                onTap: onTap,
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: AppColors.glassCard(radius: 18),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(binCode(stop.id), style: AppText.title),
                            Text(
                              stop.address ?? stop.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.caption.copyWith(fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      StatusPill(
                        label: '${fillLabel(stop.latestFillLevel)} · $pct%',
                        color: color,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Map markers & legend ──────────────────────────────────────────────────────

/// Map pin: gradient bubble showing the fill % (pulses when the bin is full).
class BinFillMarker extends StatelessWidget {
  final String? fillLevel;
  final double? fillPercentage;
  final bool selected;

  const BinFillMarker({
    super.key,
    this.fillLevel,
    this.fillPercentage,
    this.selected = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = fillColor(fillLevel);
    final label = fillLevel == null && fillPercentage == null
        ? '?'
        : '${fillPercentOf(fillLevel, fillPercentage)}';
    final size = selected ? 46.0 : 38.0;
    final isFull = (fillLevel ?? '').toLowerCase() == 'overflow';

    Widget bubble = AnimatedContainer(
      duration: Motion.medium,
      curve: Curves.easeOutBack,
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: AppGradients.forFill(fillLevel),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: selected ? 3 : 2),
        boxShadow: AppShadows.glow(color, strength: selected ? 0.6 : 0.4),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: selected ? 13 : 11,
          height: 1,
        ),
      ),
    );

    if (isFull) {
      bubble = bubble
          .animate(onPlay: (c) => c.repeat(reverse: true))
          .scaleXY(begin: 1, end: 1.08, duration: 800.ms, curve: Curves.easeInOut);
    }
    return bubble;
  }
}

class MapFillLegend extends StatelessWidget {
  final bool compact;
  const MapFillLegend({super.key, this.compact = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 10 : 12,
        vertical: compact ? 6 : 8,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: AppShadows.soft,
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _LegendDot(color: AppColors.fillOverflow, label: 'Full'),
          SizedBox(width: 10),
          _LegendDot(color: AppColors.fillHalf, label: 'Half'),
          SizedBox(width: 10),
          _LegendDot(color: AppColors.fillEmpty, label: 'Empty'),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

// ── Risk & fill ───────────────────────────────────────────────────────────────

class RiskBadge extends StatelessWidget {
  final String? riskLevel;
  const RiskBadge({super.key, this.riskLevel});

  @override
  Widget build(BuildContext context) {
    return StatusPill(
      label: (riskLevel ?? 'Unknown').toUpperCase(),
      color: riskColor(riskLevel),
      icon: Icons.shield_rounded,
    );
  }
}

class FillMeter extends StatelessWidget {
  final String? fillLevel;
  final double? fillPercentage;
  const FillMeter({super.key, this.fillLevel, this.fillPercentage});

  @override
  Widget build(BuildContext context) {
    final frac = fillFraction(fillLevel, fillPercentage);
    final color = fillColor(fillLevel);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(fillIcon(fillLevel), size: 16, color: color),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                fillLabel(fillLevel),
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
            Text(
              fillLevel == null && fillPercentage == null
                  ? '—'
                  : '${(frac * 100).round()}%',
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        AnimatedFillBar(fraction: frac, color: color),
      ],
    );
  }
}

/// Bin card for the public "nearest bins" list.
class BinLevelCard extends StatelessWidget {
  final Bin bin;
  final double? distanceMeters;
  final bool selected;
  final VoidCallback? onTap;

  const BinLevelCard({
    super.key,
    required this.bin,
    this.distanceMeters,
    this.selected = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = fillColor(bin.latestFillLevel);
    return Pressable(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.medium,
        padding: const EdgeInsets.all(16),
        decoration: AppColors.glassCard(
          tint: selected ? AppColors.brand.withValues(alpha: 0.1) : null,
          radius: 22,
        ),
        child: Row(
          children: [
            IconTile(
              icon: fillIcon(bin.latestFillLevel),
              color: color,
              gradient: AppGradients.forFill(bin.latestFillLevel),
              size: 46,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    bin.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.title,
                  ),
                  if (bin.address != null)
                    Text(
                      bin.address!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.caption.copyWith(fontSize: 12),
                    ),
                  const SizedBox(height: 10),
                  FillMeter(
                    fillLevel: bin.latestFillLevel,
                    fillPercentage: bin.latestFillPercentage,
                  ),
                ],
              ),
            ),
            if (distanceMeters != null) ...[
              const SizedBox(width: 12),
              Column(
                children: [
                  const Icon(Icons.near_me_rounded,
                      size: 16, color: AppColors.accentBlue),
                  const SizedBox(height: 4),
                  Text(
                    formatDistance(distanceMeters),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Buttons ───────────────────────────────────────────────────────────────────

class GlowPrimaryButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool fullWidth;
  final bool loading;
  final Gradient gradient;

  const GlowPrimaryButton({
    super.key,
    required this.label,
    this.icon = Icons.play_arrow_rounded,
    this.onPressed,
    this.fullWidth = true,
    this.loading = false,
    this.gradient = AppGradients.brand,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    final button = Pressable(
      onTap: enabled ? onPressed : null,
      borderRadius: BorderRadius.circular(18),
      child: AnimatedContainer(
        duration: Motion.medium,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 17),
        decoration: enabled
            ? BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                gradient: gradient,
                boxShadow: AppShadows.glow(
                  (gradient as LinearGradient).colors.last,
                  strength: 0.45,
                ),
              )
            : BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                color: AppColors.card,
              ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
          children: [
            if (loading)
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  color: Colors.white,
                ),
              )
            else
              Icon(
                icon,
                color: enabled ? Colors.white : AppColors.textMuted,
                size: 22,
              ),
            const SizedBox(width: 10),
            Text(
              label,
              style: TextStyle(
                color: enabled || loading ? Colors.white : AppColors.textMuted,
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
          ],
        ),
      ),
    );
    return fullWidth ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// Circular translucent icon button (map overlays, headers).
class GlassIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final String? tooltip;
  final int badge;
  final double size;

  const GlassIconButton({
    super.key,
    required this.icon,
    this.onTap,
    this.tooltip,
    this.badge = 0,
    this.size = 46,
  });

  @override
  Widget build(BuildContext context) {
    final btn = Pressable(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated.withValues(alpha: 0.92),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          boxShadow: AppShadows.soft,
        ),
        child: Badge(
          isLabelVisible: badge > 0,
          backgroundColor: AppColors.riskHigh,
          label: Text('$badge'),
          child: Icon(icon, color: AppColors.textPrimary, size: size * 0.46),
        ),
      ),
    );
    return tooltip == null ? btn : Tooltip(message: tooltip!, child: btn);
  }
}

// ── States ────────────────────────────────────────────────────────────────────

class ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  const ErrorState({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const IllustrationBadge(
              icon: Icons.cloud_off_rounded,
              gradient: AppGradients.danger,
              size: 72,
            ),
            const SizedBox(height: 8),
            const Text('Something went wrong', style: AppText.h2),
            const SizedBox(height: 6),
            Text(message, textAlign: TextAlign.center, style: AppText.body),
            if (onRetry != null) ...[
              const SizedBox(height: 22),
              GlowPrimaryButton(
                label: 'Try again',
                icon: Icons.refresh_rounded,
                onPressed: onRetry,
                fullWidth: false,
              ),
            ],
          ],
        ),
      ).animate().fadeIn(duration: Motion.medium).scaleXY(begin: 0.96, end: 1),
    );
  }
}

class CentredLoader extends StatelessWidget {
  final String? label;
  const CentredLoader({super.key, this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          PulseGlow(
            color: AppColors.brand,
            child: Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: AppGradients.brand,
              ),
              child: const Icon(Icons.eco_rounded, color: Colors.white, size: 30),
            ),
          ),
          if (label != null) ...[
            const SizedBox(height: 20),
            Text(label!, style: AppText.body),
          ],
        ],
      ),
    );
  }
}

/// Shimmering placeholder block.
class SkeletonBox extends StatelessWidget {
  final double? width;
  final double? height;
  final double radius;

  const SkeletonBox({super.key, this.width, this.height, this.radius = 16});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(radius),
      ),
    )
        .animate(onPlay: (c) => c.repeat())
        .shimmer(
          duration: 1400.ms,
          color: Colors.white.withValues(alpha: 0.06),
        );
  }
}

/// Skeleton of a list of cards — shown while data loads.
class SkeletonList extends StatelessWidget {
  final int count;
  final double itemHeight;
  final EdgeInsets padding;
  final Widget? header;

  const SkeletonList({
    super.key,
    this.count = 5,
    this.itemHeight = 88,
    this.padding = const EdgeInsets.all(20),
    this.header,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: padding,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        if (header != null) header!,
        for (var i = 0; i < count; i++) ...[
          SkeletonBox(height: itemHeight, radius: 22),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}
