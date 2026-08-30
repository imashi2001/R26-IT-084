import 'package:flutter/material.dart';
import '../../domain/models.dart';
import '../../theme/app_theme.dart';

// ── Fill level helpers ────────────────────────────────────────────────────────

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
      return 'Half Full';
    case 'overflow':
      return 'Overflow';
    default:
      return 'Unknown';
  }
}

double fillFraction(String? level, double? pct) {
  if (pct != null) return (pct.clamp(0, 100)) / 100;
  switch ((level ?? '').toLowerCase()) {
    case 'empty':    return 0.18;
    case 'half':     return 0.55;
    case 'overflow': return 1.0;
    default:         return 0.0;
  }
}

Color riskColor(String? level) {
  switch ((level ?? '').toUpperCase()) {
    case 'LOW':      return AppColors.riskLow;
    case 'MEDIUM':   return AppColors.riskMedium;
    case 'HIGH':     return AppColors.riskHigh;
    case 'CRITICAL': return AppColors.riskCritical;
    default:         return AppColors.textSecondary;
  }
}

String fillShort(String? level) {
  switch ((level ?? '').toLowerCase()) {
    case 'empty':
      return 'E';
    case 'half':
      return 'H';
    case 'overflow':
      return 'O';
    default:
      return '?';
  }
}

String formatDistance(double? meters) {
  if (meters == null || !meters.isFinite) return '—';
  if (meters < 1000) return '${meters.round()} m';
  return '${(meters / 1000).toStringAsFixed(1)} km';
}

String formatTs(String? iso) {
  if (iso == null || iso.isEmpty) return '—';
  try {
    final t = DateTime.parse(iso).toLocal();
    final hh = t.hour.toString().padLeft(2, '0');
    final mm = t.minute.toString().padLeft(2, '0');
    return '${t.day}/${t.month}/${t.year}  $hh:$mm';
  } catch (_) {
    return iso;
  }
}

String timeAgo(String? iso) {
  if (iso == null || iso.isEmpty) return '—';
  try {
    final t = DateTime.parse(iso).toLocal();
    final diff = DateTime.now().difference(t);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hr ago';
    return '${diff.inDays} d ago';
  } catch (_) {
    return iso;
  }
}

String binCode(int id) => 'BIN-${id.toString().padLeft(3, '0')}';

// ── Layout primitives ───────────────────────────────────────────────────────────

class StaffCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? tint;
  const StaffCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.tint,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: AppColors.glassCard(tint: tint),
      child: child,
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String text;
  const SectionTitle(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w800,
        color: AppColors.textPrimary,
      ),
    );
  }
}

class EmptyHint extends StatelessWidget {
  final String message;
  const EmptyHint({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
      ),
    );
  }
}

class KpiStatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  final double width;

  const KpiStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
    this.width = 160,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: 118,
      child: StaffCard(
        padding: const EdgeInsets.all(14),
        tint: color.withValues(alpha: 0.08),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const Spacer(),
            Text(
              value,
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: color,
                height: 1,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
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
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      tint: color.withValues(alpha: 0.06),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 6),
          ],
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color == AppColors.brand ? AppColors.textPrimary : color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class SegmentedFilterRow extends StatelessWidget {
  final List<(String, String)> options;
  final String selected;
  final ValueChanged<String> onSelected;
  final Map<String, Color>? accentById;

  const SegmentedFilterRow({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
    this.accentById,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final (id, label) in options) ...[
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilterPill(
                label: label,
                selected: selected == id,
                onTap: () => onSelected(id),
                activeColor: accentById?[id],
              ),
            ),
          ],
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
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(100),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(100),
            color: selected
                ? accent.withValues(alpha: 0.18)
                : AppColors.surfaceElevated,
            border: Border.all(
              color: selected ? accent : AppColors.border.withValues(alpha: 0.5),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Text(
            count != null ? '$label ($count)' : label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: selected ? accent : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class PriorityBinTile extends StatelessWidget {
  final Bin bin;
  final VoidCallback? onTap;

  const PriorityBinTile({super.key, required this.bin, this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = fillColor(bin.latestFillLevel);
    final pct = bin.latestFillPercentage?.round() ??
        (bin.latestFillLevel?.toLowerCase() == 'overflow'
            ? 100
            : bin.latestFillLevel?.toLowerCase() == 'half'
                ? 55
                : 10);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: AppColors.glassCard(tint: color.withValues(alpha: 0.06)),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.delete_outline, color: color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      binCode(bin.id),
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      bin.address ?? bin.location ?? bin.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(100),
                      border: Border.all(color: color.withValues(alpha: 0.4)),
                    ),
                    child: Text(
                      '$pct%',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: color,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    timeAgo(bin.latestCapturedAt),
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AlertFeedTile extends StatelessWidget {
  final StaffAlert alert;
  final VoidCallback? onTap;

  const AlertFeedTile({super.key, required this.alert, this.onTap});

  Color get _color {
    switch (alert.severity) {
      case 'critical':
        return AppColors.riskHigh;
      case 'warning':
        return AppColors.riskMedium;
      default:
        return const Color(0xFF38BDF8);
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _color;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: AppColors.glassCard(tint: color.withValues(alpha: 0.1)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  alert.severity == 'critical'
                      ? Icons.error_outline
                      : alert.severity == 'warning'
                          ? Icons.warning_amber_outlined
                          : Icons.info_outline,
                  color: color,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      alert.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (alert.summary != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        alert.summary!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      timeAgo(alert.createdAt),
                      style: TextStyle(fontSize: 11, color: color),
                    ),
                  ],
                ),
              ),
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 4),
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class RouteStopTile extends StatelessWidget {
  final CollectionStop stop;
  final VoidCallback? onTap;

  const RouteStopTile({super.key, required this.stop, this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = fillColor(stop.latestFillLevel);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: AppColors.glassCard(tint: color.withValues(alpha: 0.06)),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: color.withValues(alpha: 0.4),
                      blurRadius: 8,
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  '${stop.order}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      binCode(stop.id),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      stop.address ?? stop.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(100),
                  border: Border.all(color: color.withValues(alpha: 0.4)),
                ),
                child: Text(
                  fillLabel(stop.latestFillLevel),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Map pin: fill color + E/H/O (and % when known).
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
    final pct = fillPercentage != null ? '${fillPercentage!.round()}' : fillShort(fillLevel);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: selected ? 48 : 40,
      height: selected ? 48 : 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: selected ? 3 : 2),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: selected ? 0.55 : 0.35),
            blurRadius: selected ? 12 : 6,
          ),
        ],
      ),
      child: Text(
        pct,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: selected ? 13 : 11,
          height: 1,
        ),
      ),
    );
  }
}

class MapFillLegend extends StatelessWidget {
  final bool compact;
  const MapFillLegend({super.key, this.compact = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 6 : 8,
      ),
      decoration: AppColors.glassCard(radius: compact ? 10 : 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!compact)
            const Text(
              'Fill level',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.textSecondary,
              ),
            ),
          if (!compact) const SizedBox(height: 4),
          const _LegendRow(color: AppColors.fillOverflow, label: 'Full'),
          SizedBox(height: compact ? 3 : 4),
          const _LegendRow(color: AppColors.fillHalf, label: 'Half'),
          SizedBox(height: compact ? 3 : 4),
          const _LegendRow(color: AppColors.fillEmpty, label: 'Empty'),
        ],
      ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendRow({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label,
            style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary)),
      ],
    );
  }
}

// ── RiskBadge ─────────────────────────────────────────────────────────────────

class RiskBadge extends StatelessWidget {
  final String? riskLevel;
  const RiskBadge({super.key, this.riskLevel});

  @override
  Widget build(BuildContext context) {
    final label = (riskLevel ?? 'Unknown').toUpperCase();
    final color = riskColor(riskLevel);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: color.withValues(alpha: 0.6)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

// ── FillMeter ─────────────────────────────────────────────────────────────────

class FillMeter extends StatelessWidget {
  final String? fillLevel;
  final double? fillPercentage;
  const FillMeter({super.key, this.fillLevel, this.fillPercentage});

  @override
  Widget build(BuildContext context) {
    final frac  = fillFraction(fillLevel, fillPercentage);
    final color = fillColor(fillLevel);
    final label = fillLabel(fillLevel);
    final pct   = fillPercentage != null
        ? '${fillPercentage!.round()}%'
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
            if (pct != null)
              Text(pct,
                  style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w600,
                      fontSize: 12)),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: frac,
            minHeight: 8,
            backgroundColor: AppColors.card,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }
}

// ── BinLevelCard ──────────────────────────────────────────────────────────────

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
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected ? AppColors.brand.withValues(alpha: 0.08) : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? AppColors.brand : AppColors.border,
            width: selected ? 1.5 : 0.8,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: fillColor(bin.latestFillLevel),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    bin.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: AppColors.textPrimary,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (distanceMeters != null)
                  _distChip(distanceMeters!),
              ],
            ),
            if (bin.address != null) ...[
              const SizedBox(height: 4),
              Text(
                bin.address!,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 12),
            FillMeter(
                fillLevel: bin.latestFillLevel,
                fillPercentage: bin.latestFillPercentage),
            if (bin.latestRiskLevel != null) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Text('Risk: ',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.textSecondary)),
                  RiskBadge(riskLevel: bin.latestRiskLevel),
                ],
              ),
            ],
            if (bin.latestCapturedAt != null) ...[
              const SizedBox(height: 8),
              Text(
                'Updated ${formatTs(bin.latestCapturedAt)}',
                style: const TextStyle(
                    fontSize: 11, color: AppColors.textSecondary),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _distChip(double meters) {
    final label = meters < 1000
        ? '${meters.round()} m'
        : '${(meters / 1000).toStringAsFixed(1)} km';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(100),
      ),
      child: Text(
        label,
        style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary),
      ),
    );
  }
}

// ── GlowPrimaryButton ─────────────────────────────────────────────────────────

class GlowPrimaryButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool fullWidth;

  const GlowPrimaryButton({
    super.key,
    required this.label,
    this.icon = Icons.play_arrow_rounded,
    this.onPressed,
    this.fullWidth = true,
  });

  @override
  Widget build(BuildContext context) {
    final child = Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          decoration: onPressed == null
              ? BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  color: AppColors.card,
                )
              : AppColors.glowButton(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
            children: [
              Icon(icon, color: Colors.white, size: 22),
              const SizedBox(width: 10),
              Text(
                label,
                style: TextStyle(
                  color: onPressed == null
                      ? AppColors.textMuted
                      : Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ],
          ),
        ),
      ),
    );
    return fullWidth ? SizedBox(width: double.infinity, child: child) : child;
  }
}

// ── ErrorState ────────────────────────────────────────────────────────────────

class ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  const ErrorState({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline,
                size: 48, color: AppColors.riskHigh),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 14),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 20),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── LoadingOverlay ────────────────────────────────────────────────────────────

class CentredLoader extends StatelessWidget {
  final String? label;
  const CentredLoader({super.key, this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: AppColors.brand),
          if (label != null) ...[
            const SizedBox(height: 16),
            Text(label!,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 13)),
          ],
        ],
      ),
    );
  }
}
