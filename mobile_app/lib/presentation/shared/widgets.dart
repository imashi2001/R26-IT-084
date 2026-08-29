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
  const MapFillLegend({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          _LegendRow(color: AppColors.fillEmpty, label: 'Empty'),
          SizedBox(height: 4),
          _LegendRow(color: AppColors.fillHalf, label: 'Half'),
          SizedBox(height: 4),
          _LegendRow(color: AppColors.fillOverflow, label: 'Overflow'),
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
