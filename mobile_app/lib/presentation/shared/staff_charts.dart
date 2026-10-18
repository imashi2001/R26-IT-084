import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../domain/models.dart';
import '../../theme/app_theme.dart';
import 'widgets.dart';

/// Animated donut (progress ring) with a gradient arc.
class DonutChart extends StatelessWidget {
  final double value;
  final double size;
  final Gradient gradient;
  final String centerLabel;
  final String? centerSub;
  final double stroke;

  const DonutChart({
    super.key,
    required this.value,
    this.size = 96,
    this.gradient = AppGradients.brand,
    this.centerLabel = '',
    this.centerSub,
    this.stroke = 11,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.clamp(0.0, 1.0)),
      duration: const Duration(milliseconds: 1300),
      curve: Curves.easeOutCubic,
      builder: (_, v, __) => SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            CustomPaint(
              size: Size(size, size),
              painter: _DonutPainter(
                progress: v,
                gradient: gradient,
                stroke: stroke,
              ),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  centerLabel,
                  style: TextStyle(
                    fontSize: size * 0.2,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    height: 1.1,
                  ),
                ),
                if (centerSub != null)
                  Text(centerSub!, style: AppText.caption.copyWith(fontSize: 10)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  final double progress;
  final Gradient gradient;
  final double stroke;

  _DonutPainter({
    required this.progress,
    required this.gradient,
    required this.stroke,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - stroke / 2 - 2;
    final rect = Rect.fromCircle(center: center, radius: radius);

    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.06)
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke,
    );
    if (progress <= 0) return;
    canvas.drawArc(
      rect,
      -math.pi / 2,
      2 * math.pi * progress,
      false,
      Paint()
        ..shader = SweepGradient(
          startAngle: -math.pi / 2,
          endAngle: 3 * math.pi / 2,
          colors: (gradient as LinearGradient).colors,
          transform: const GradientRotation(-math.pi / 2),
        ).createShader(rect)
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant _DonutPainter old) =>
      old.progress != progress || old.gradient != gradient;
}

/// Stacked horizontal bar: share of full / half / empty bins.
class FillDistributionBar extends StatelessWidget {
  final int full;
  final int half;
  final int empty;
  final int unknown;

  const FillDistributionBar({
    super.key,
    required this.full,
    required this.half,
    required this.empty,
    this.unknown = 0,
  });

  @override
  Widget build(BuildContext context) {
    final total = full + half + empty + unknown;
    final parts = [
      (full, AppColors.fillOverflow),
      (half, AppColors.fillHalf),
      (empty, AppColors.fillEmpty),
      (unknown, AppColors.fillUnknown),
    ].where((p) => p.$1 > 0).toList();

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 1100),
      curve: Curves.easeOutCubic,
      builder: (_, t, __) => ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          height: 12,
          child: total == 0
              ? Container(color: Colors.white.withValues(alpha: 0.06))
              : Row(
                  children: [
                    for (var i = 0; i < parts.length; i++) ...[
                      Expanded(
                        flex: math.max(1, (parts[i].$1 * 1000 * t).round()),
                        child: Container(color: parts[i].$2),
                      ),
                      if (i < parts.length - 1) const SizedBox(width: 3),
                    ],
                    if (t < 1)
                      Expanded(
                        flex: math.max(1, (total * 1000 * (1 - t)).round()),
                        child: const SizedBox(),
                      ),
                  ],
                ),
        ),
      ),
    );
  }
}

/// Bar chart of the hygienic-risk forecast — one bar per slot, coloured and
/// sized by risk level.
class RiskForecastChart extends StatelessWidget {
  final List<RiskSlot> slots;
  final double height;

  const RiskForecastChart({super.key, required this.slots, this.height = 120});

  @override
  Widget build(BuildContext context) {
    final shown = slots.take(12).toList();
    if (shown.isEmpty) {
      return SizedBox(
        height: height,
        child: const Center(
          child: Text('No forecast available', style: AppText.caption),
        ),
      );
    }
    return SizedBox(
      height: height + 34,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < shown.length; i++)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: _ForecastBar(
                  slot: shown[i],
                  maxHeight: height,
                  index: i,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ForecastBar extends StatelessWidget {
  final RiskSlot slot;
  final double maxHeight;
  final int index;

  const _ForecastBar({
    required this.slot,
    required this.maxHeight,
    required this.index,
  });

  @override
  Widget build(BuildContext context) {
    final color = riskColor(slot.level);
    final frac = 0.22 + slot.rank * 0.26;
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Tooltip(
          message:
              '${slot.level}${slot.tempC != null ? ' · ${slot.tempC!.round()}°C' : ''}'
              '${slot.message != null ? '\n${slot.message}' : ''}',
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: frac),
            duration: Duration(milliseconds: 700 + index * 60),
            curve: Curves.easeOutBack,
            builder: (_, v, __) => Container(
              height: maxHeight * v.clamp(0.0, 1.0),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [color, color.withValues(alpha: 0.35)],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          slot.time != null ? '${slot.time!.hour.toString().padLeft(2, '0')}h' : '',
          style: AppText.caption.copyWith(fontSize: 9),
        ),
        const SizedBox(height: 2),
        Text(
          slot.tempC != null ? '${slot.tempC!.round()}°' : '',
          style: AppText.caption.copyWith(
            fontSize: 9,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

/// Area chart of fill % over the bin's recent captures (oldest → newest).
class FillHistoryChart extends StatelessWidget {
  final List<CaptureRecord> captures;
  final double height;

  const FillHistoryChart({
    super.key,
    required this.captures,
    this.height = 130,
  });

  @override
  Widget build(BuildContext context) {
    final pts = captures.reversed
        .map((c) => fillFraction(c.fillLevel, c.fillPercentage))
        .toList();
    if (pts.length < 2) {
      return SizedBox(
        height: height,
        child: const Center(
          child: Text(
            'Not enough captures yet to draw a trend',
            style: AppText.caption,
          ),
        ),
      );
    }
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 1200),
      curve: Curves.easeOutCubic,
      builder: (_, t, __) => SizedBox(
        height: height,
        width: double.infinity,
        child: CustomPaint(painter: _AreaPainter(points: pts, progress: t)),
      ),
    );
  }
}

class _AreaPainter extends CustomPainter {
  final List<double> points;
  final double progress;

  _AreaPainter({required this.points, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height - 6;

    // Guide lines at 50% and 100%
    final guide = Paint()
      ..color = Colors.white.withValues(alpha: 0.05)
      ..strokeWidth = 1;
    for (final f in [0.0, 0.5, 1.0]) {
      final y = 3 + h * (1 - f);
      canvas.drawLine(Offset(0, y), Offset(w, y), guide);
    }

    Offset at(int i) => Offset(
          i / (points.length - 1) * w,
          3 + h * (1 - points[i] * progress),
        );

    final line = Path()..moveTo(at(0).dx, at(0).dy);
    for (var i = 1; i < points.length; i++) {
      final p0 = at(i - 1);
      final p1 = at(i);
      final mid = (p0.dx + p1.dx) / 2;
      line.cubicTo(mid, p0.dy, mid, p1.dy, p1.dx, p1.dy);
    }
    final area = Path.from(line)
      ..lineTo(w, size.height)
      ..lineTo(0, size.height)
      ..close();

    canvas.drawPath(
      area,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.brand.withValues(alpha: 0.35),
            AppColors.brand.withValues(alpha: 0.0),
          ],
        ).createShader(Offset.zero & size),
    );
    canvas.drawPath(
      line,
      Paint()
        ..shader = const LinearGradient(
          colors: [AppColors.accentTeal, AppColors.brandGlow, AppColors.lime],
        ).createShader(Offset.zero & size)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round,
    );

    for (var i = 0; i < points.length; i++) {
      final p = at(i);
      final c = points[i] >= 0.9
          ? AppColors.fillOverflow
          : points[i] >= 0.45
              ? AppColors.fillHalf
              : AppColors.fillEmpty;
      canvas.drawCircle(p, 5, Paint()..color = AppColors.background);
      canvas.drawCircle(p, 3.5, Paint()..color = c);
    }
  }

  @override
  bool shouldRepaint(covariant _AreaPainter old) =>
      old.progress != progress || old.points != points;
}

/// Mini sparkline (kept for compact tiles).
class SparklineChart extends StatelessWidget {
  final List<double> points;
  final Color color;
  final double height;

  const SparklineChart({
    super.key,
    required this.points,
    required this.color,
    this.height = 28,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(
        painter: _SparklinePainter(points: points, color: color),
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  final List<double> points;
  final Color color;

  _SparklinePainter({required this.points, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final max = points.reduce(math.max);
    final min = points.reduce(math.min);
    final range = (max - min).clamp(0.01, double.infinity);

    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final x = (i / (points.length - 1)) * size.width;
      final y = size.height - ((points[i] - min) / range) * (size.height - 4);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter old) =>
      old.points != points || old.color != color;
}
