import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Animated city scene — skyline, smart bins sending signals, drifting leaves.
// Used as hero artwork on the welcome and login screens.
// ─────────────────────────────────────────────────────────────────────────────

class CityScene extends StatefulWidget {
  final double height;
  final bool showBins;

  const CityScene({super.key, this.height = 320, this.showBins = true});

  @override
  State<CityScene> createState() => _CitySceneState();
}

class _CitySceneState extends State<CityScene>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 12),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: widget.height,
      width: double.infinity,
      child: RepaintBoundary(
        child: AnimatedBuilder(
          animation: _c,
          builder: (_, __) => CustomPaint(
            painter: _CityPainter(t: _c.value, showBins: widget.showBins),
          ),
        ),
      ),
    );
  }
}

class _CityPainter extends CustomPainter {
  final double t;
  final bool showBins;

  _CityPainter({required this.t, required this.showBins});

  static final _far = _skyline(seed: 7, count: 14, minH: 0.18, maxH: 0.42);
  static final _near = _skyline(seed: 21, count: 11, minH: 0.22, maxH: 0.55);

  static List<(double, double, double)> _skyline({
    required int seed,
    required int count,
    required double minH,
    required double maxH,
  }) {
    final r = math.Random(seed);
    final out = <(double, double, double)>[];
    var x = -0.04;
    for (var i = 0; i < count; i++) {
      final w = 0.06 + r.nextDouble() * 0.07;
      final h = minH + r.nextDouble() * (maxH - minH);
      out.add((x, w, h));
      x += w + 0.008 + r.nextDouble() * 0.02;
    }
    return out;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final ground = h * 0.84;

    // Sky
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF0B3B33), Color(0xFF0A1F1C), Color(0xFF0A0F14)],
        ).createShader(Offset.zero & size),
    );

    // Stars
    final starPaint = Paint()..color = Colors.white;
    final sr = math.Random(3);
    for (var i = 0; i < 26; i++) {
      final sx = sr.nextDouble() * w;
      final sy = sr.nextDouble() * h * 0.45;
      final twinkle =
          0.25 + 0.55 * (0.5 + 0.5 * math.sin((t * 2 * math.pi * 3) + i));
      starPaint.color = Colors.white.withValues(alpha: twinkle * 0.7);
      canvas.drawCircle(Offset(sx, sy), 0.6 + sr.nextDouble() * 0.9, starPaint);
    }

    // Glowing sun / moon
    final sun = Offset(w * 0.78, h * 0.26);
    canvas.drawCircle(
      sun,
      w * 0.22,
      Paint()
        ..shader = RadialGradient(
          colors: [
            AppColors.brandGlow.withValues(alpha: 0.35),
            AppColors.brandGlow.withValues(alpha: 0.0),
          ],
        ).createShader(Rect.fromCircle(center: sun, radius: w * 0.22)),
    );
    canvas.drawCircle(
      sun,
      w * 0.065,
      Paint()
        ..shader = const LinearGradient(
          colors: [Color(0xFFD9F99D), Color(0xFF34D399)],
        ).createShader(Rect.fromCircle(center: sun, radius: w * 0.065)),
    );

    // Far skyline
    final farPaint = Paint()..color = const Color(0xFF12322E);
    for (final (x, bw, bh) in _far) {
      canvas.drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(x * w, ground - bh * h, bw * w, bh * h),
          topLeft: const Radius.circular(3),
          topRight: const Radius.circular(3),
        ),
        farPaint,
      );
    }

    // Near skyline with lit windows
    final nearPaint = Paint()..color = const Color(0xFF0C1F1D);
    final winR = math.Random(11);
    for (final (x, bw, bh) in _near) {
      final rect = Rect.fromLTWH(x * w, ground - bh * h * 0.8, bw * w, bh * h * 0.8);
      canvas.drawRRect(
        RRect.fromRectAndCorners(
          rect,
          topLeft: const Radius.circular(4),
          topRight: const Radius.circular(4),
        ),
        nearPaint,
      );
      for (var wy = rect.top + 8; wy < rect.bottom - 10; wy += 11) {
        for (var wx = rect.left + 6; wx < rect.right - 6; wx += 9) {
          if (winR.nextDouble() > 0.42) continue;
          final flicker = 0.35 +
              0.4 * (0.5 + 0.5 * math.sin(t * 2 * math.pi + wx * 0.07 + wy));
          canvas.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromLTWH(wx, wy, 4, 5),
              const Radius.circular(1),
            ),
            Paint()
              ..color = const Color(0xFFFDE68A).withValues(alpha: flicker * 0.55),
          );
        }
      }
    }

    // Ground + path
    canvas.drawRect(
      Rect.fromLTWH(0, ground, w, h - ground),
      Paint()..color = const Color(0xFF0B1714),
    );
    canvas.drawRect(
      Rect.fromLTWH(0, ground, w, 2),
      Paint()..color = AppColors.brand.withValues(alpha: 0.25),
    );

    // Trees
    _tree(canvas, Offset(w * 0.08, ground), h * 0.11);
    _tree(canvas, Offset(w * 0.9, ground), h * 0.13);
    _tree(canvas, Offset(w * 0.63, ground), h * 0.08);

    if (showBins) {
      final binW = w * 0.075;
      final binH = h * 0.12;
      final cx = w * 0.36;
      _bin(canvas, Offset(cx - binW * 1.35, ground), binW, binH, 0.25,
          AppColors.fillEmpty);
      _bin(canvas, Offset(cx, ground), binW, binH, 0.6, AppColors.fillHalf);
      _bin(canvas, Offset(cx + binW * 1.35, ground), binW, binH, 0.95,
          AppColors.fillOverflow);

      // Signal waves rising from the middle bin
      final origin = Offset(cx, ground - binH - 6);
      for (var i = 0; i < 3; i++) {
        final p = (t * 3 + i / 3) % 1.0;
        canvas.drawArc(
          Rect.fromCircle(center: origin, radius: 8 + p * 26),
          -math.pi * 0.8,
          math.pi * 0.6,
          false,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2
            ..strokeCap = StrokeCap.round
            ..color = AppColors.brandGlow.withValues(alpha: (1 - p) * 0.8),
        );
      }
    }

    // Drifting leaves
    for (var i = 0; i < 7; i++) {
      final p = (t + i / 7) % 1.0;
      final lx = w * ((p * 1.2 + i * 0.13) % 1.1) - w * 0.05;
      final ly = h * (0.15 + 0.08 * i) + math.sin(p * math.pi * 4 + i) * 14;
      _leaf(canvas, Offset(lx, ly), 5 + (i % 3) * 2.0, p * math.pi * 4 + i,
          i.isEven ? AppColors.brandGlow : AppColors.lime);
    }
  }

  void _tree(Canvas canvas, Offset base, double size) {
    canvas.drawRect(
      Rect.fromCenter(
        center: base.translate(0, -size * 0.25),
        width: size * 0.12,
        height: size * 0.5,
      ),
      Paint()..color = const Color(0xFF1F2F25),
    );
    final leaves = Paint()..color = const Color(0xFF14532D);
    canvas.drawCircle(base.translate(0, -size * 0.75), size * 0.38, leaves);
    canvas.drawCircle(
        base.translate(-size * 0.22, -size * 0.55), size * 0.26, leaves);
    canvas.drawCircle(
        base.translate(size * 0.22, -size * 0.55), size * 0.26, leaves);
  }

  void _bin(Canvas canvas, Offset base, double bw, double bh, double fill,
      Color color) {
    final body = Path()
      ..moveTo(base.dx - bw / 2, base.dy - bh)
      ..lineTo(base.dx + bw / 2, base.dy - bh)
      ..lineTo(base.dx + bw * 0.4, base.dy)
      ..lineTo(base.dx - bw * 0.4, base.dy)
      ..close();
    canvas.drawPath(body, Paint()..color = const Color(0xFF1D2B35));
    canvas.save();
    canvas.clipPath(body);
    canvas.drawRect(
      Rect.fromLTRB(base.dx - bw, base.dy - bh * fill, base.dx + bw, base.dy),
      Paint()..color = color.withValues(alpha: 0.85),
    );
    canvas.restore();
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(base.dx, base.dy - bh - 3),
          width: bw * 1.15,
          height: 5,
        ),
        const Radius.circular(3),
      ),
      Paint()..color = const Color(0xFF2B3D49),
    );
  }

  void _leaf(Canvas canvas, Offset c, double s, double rot, Color color) {
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(rot);
    final path = Path()
      ..moveTo(0, -s)
      ..quadraticBezierTo(s, 0, 0, s)
      ..quadraticBezierTo(-s, 0, 0, -s);
    canvas.drawPath(path, Paint()..color = color.withValues(alpha: 0.75));
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _CityPainter old) =>
      old.t != t || old.showBins != showBins;
}

// ─────────────────────────────────────────────────────────────────────────────
// Liquid bin gauge — a bin silhouette filled with animated waves to the
// current fill level. The signature visual of the bin detail screen.
// ─────────────────────────────────────────────────────────────────────────────

class LiquidBinGauge extends StatefulWidget {
  /// 0..1
  final double fraction;
  final Color color;
  final double width;
  final double height;
  final Widget? center;

  const LiquidBinGauge({
    super.key,
    required this.fraction,
    required this.color,
    this.width = 140,
    this.height = 170,
    this.center,
  });

  @override
  State<LiquidBinGauge> createState() => _LiquidBinGaugeState();
}

class _LiquidBinGaugeState extends State<LiquidBinGauge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _wave = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 3),
  )..repeat();

  @override
  void dispose() {
    _wave.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: widget.fraction.clamp(0.0, 1.0)),
      duration: const Duration(milliseconds: 1400),
      curve: Curves.easeOutCubic,
      builder: (_, level, __) => SizedBox(
        width: widget.width,
        height: widget.height,
        child: Stack(
          alignment: Alignment.center,
          children: [
            RepaintBoundary(
              child: AnimatedBuilder(
                animation: _wave,
                builder: (_, __) => CustomPaint(
                  size: Size(widget.width, widget.height),
                  painter: _LiquidBinPainter(
                    level: level,
                    phase: _wave.value * 2 * math.pi,
                    color: widget.color,
                  ),
                ),
              ),
            ),
            if (widget.center != null)
              Padding(
                padding: EdgeInsets.only(top: widget.height * 0.14),
                child: widget.center,
              ),
          ],
        ),
      ),
    );
  }
}

class _LiquidBinPainter extends CustomPainter {
  final double level;
  final double phase;
  final Color color;

  _LiquidBinPainter({
    required this.level,
    required this.phase,
    required this.color,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final lidH = h * 0.08;
    final top = h * 0.14;

    // Glow under the bin
    canvas.drawOval(
      Rect.fromCenter(center: Offset(w / 2, h - 2), width: w * 0.8, height: 14),
      Paint()
        ..color = color.withValues(alpha: 0.25)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10),
    );

    // Body outline
    final body = Path()
      ..moveTo(w * 0.08, top)
      ..lineTo(w * 0.92, top)
      ..lineTo(w * 0.82, h - 6)
      ..quadraticBezierTo(w * 0.81, h, w * 0.76, h)
      ..lineTo(w * 0.24, h)
      ..quadraticBezierTo(w * 0.19, h, w * 0.18, h - 6)
      ..close();

    canvas.drawPath(
      body,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.card, AppColors.surface],
        ).createShader(Offset.zero & size),
    );

    // Liquid
    canvas.save();
    canvas.clipPath(body);
    final bodyH = h - top;
    final surface = h - bodyH * level;
    const amp = 5.0;

    Path wave(double ph, double offset) {
      final p = Path()..moveTo(0, h);
      for (double x = 0; x <= w; x += 2) {
        p.lineTo(
          x,
          surface + offset + math.sin(x / w * 2 * math.pi * 1.4 + ph) * amp,
        );
      }
      p
        ..lineTo(w, h)
        ..close();
      return p;
    }

    if (level > 0.001) {
      canvas.drawPath(
        wave(phase + math.pi, 3),
        Paint()..color = color.withValues(alpha: 0.35),
      );
      canvas.drawPath(
        wave(phase, 0),
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [color.withValues(alpha: 0.95), color.withValues(alpha: 0.6)],
          ).createShader(Rect.fromLTWH(0, surface, w, h - surface)),
      );
    }

    // Vertical ribs
    final rib = Paint()
      ..color = Colors.white.withValues(alpha: 0.05)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    for (final fx in [0.33, 0.5, 0.67]) {
      canvas.drawLine(
        Offset(w * fx, top + bodyH * 0.12),
        Offset(w * fx, h - bodyH * 0.1),
        rib,
      );
    }
    canvas.restore();

    canvas.drawPath(
      body,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = Colors.white.withValues(alpha: 0.10),
    );

    // Lid + handle
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(0, top - lidH - 2, w, lidH),
        const Radius.circular(8),
      ),
      Paint()
        ..shader = LinearGradient(
          colors: [color.withValues(alpha: 0.9), color.withValues(alpha: 0.55)],
        ).createShader(Rect.fromLTWH(0, top - lidH, w, lidH)),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(w / 2, top - lidH - 6),
          width: w * 0.28,
          height: 8,
        ),
        const Radius.circular(4),
      ),
      Paint()..color = color.withValues(alpha: 0.7),
    );
  }

  @override
  bool shouldRepaint(covariant _LiquidBinPainter old) =>
      old.level != level || old.phase != phase || old.color != color;
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional photo with illustrated fallback
// ─────────────────────────────────────────────────────────────────────────────

/// Shows `assets/images/<name>` when the file is bundled, otherwise [fallback].
/// Lets the team drop in real photos later without code changes.
class AssetPhotoOr extends StatelessWidget {
  final String asset;
  final Widget fallback;
  final BoxFit fit;

  const AssetPhotoOr({
    super.key,
    required this.asset,
    required this.fallback,
    this.fit = BoxFit.cover,
  });

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      asset,
      fit: fit,
      width: double.infinity,
      height: double.infinity,
      errorBuilder: (_, __, ___) => fallback,
    );
  }
}

/// Circular gradient badge with an icon and orbiting dots — used for empty
/// and error states.
class IllustrationBadge extends StatefulWidget {
  final IconData icon;
  final Gradient gradient;
  final double size;

  const IllustrationBadge({
    super.key,
    required this.icon,
    this.gradient = AppGradients.brand,
    this.size = 96,
  });

  @override
  State<IllustrationBadge> createState() => _IllustrationBadgeState();
}

class _IllustrationBadgeState extends State<IllustrationBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 6),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.size;
    final colors = (widget.gradient as LinearGradient).colors;
    return SizedBox(
      width: s * 1.5,
      height: s * 1.5,
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, child) {
          final a = _c.value * 2 * math.pi;
          return Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: s * 1.35,
                height: s * 1.35,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colors.first.withValues(alpha: 0.06),
                ),
              ),
              for (var i = 0; i < 3; i++)
                Transform.translate(
                  offset: Offset(
                    math.cos(a + i * 2.1) * s * 0.66,
                    math.sin(a + i * 2.1) * s * 0.66,
                  ),
                  child: Container(
                    width: 8 - i * 2.0,
                    height: 8 - i * 2.0,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: colors[i % colors.length].withValues(alpha: 0.8),
                    ),
                  ),
                ),
              child!,
            ],
          );
        },
        child: Container(
          width: s,
          height: s,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: widget.gradient,
            boxShadow: AppShadows.glow(colors.last, strength: 0.35),
          ),
          child: Icon(widget.icon, color: Colors.white, size: s * 0.44),
        ),
      ),
    );
  }
}
