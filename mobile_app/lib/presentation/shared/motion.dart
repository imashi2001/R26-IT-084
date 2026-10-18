import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Motion tokens shared by every screen so animations feel consistent.
class Motion {
  Motion._();

  static const fast = Duration(milliseconds: 180);
  static const medium = Duration(milliseconds: 320);
  static const slow = Duration(milliseconds: 650);
  static const curve = Curves.easeOutCubic;

  /// Delay for the n-th item of a staggered list (capped so long lists
  /// don't keep the user waiting).
  static Duration stagger(int index, {int stepMs = 55, int maxSteps = 8}) =>
      Duration(milliseconds: stepMs * index.clamp(0, maxSteps));
}

extension EntranceAnimation on Widget {
  /// Fade + slide-up entrance used for cards and list items.
  Widget entrance({int index = 0, double dy = 0.08}) => animate(
        delay: Motion.stagger(index),
      ).fadeIn(duration: Motion.medium, curve: Motion.curve).slideY(
            begin: dy,
            end: 0,
            duration: Motion.medium,
            curve: Motion.curve,
          );
}

/// Scales its child down slightly while pressed — gives every tappable card
/// a tactile, "native" feel. Adds a light haptic tick on tap.
class Pressable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double pressedScale;
  final BorderRadius borderRadius;

  const Pressable({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.pressedScale = 0.97,
    this.borderRadius = const BorderRadius.all(Radius.circular(20)),
  });

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (widget.onTap == null && widget.onLongPress == null) return;
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: widget.onTap == null
          ? null
          : () {
              HapticFeedback.selectionClick();
              widget.onTap!();
            },
      onLongPress: widget.onLongPress,
      child: AnimatedScale(
        scale: _down ? widget.pressedScale : 1,
        duration: Motion.fast,
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// Number that counts up from 0 when it first appears (and animates between
/// values when it changes).
class AnimatedCount extends StatelessWidget {
  final num value;
  final TextStyle style;
  final String suffix;
  final int decimals;
  final Duration duration;

  const AnimatedCount({
    super.key,
    required this.value,
    required this.style,
    this.suffix = '',
    this.decimals = 0,
    this.duration = const Duration(milliseconds: 900),
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.toDouble()),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (_, v, __) => Text(
        '${v.toStringAsFixed(decimals)}$suffix',
        style: style,
      ),
    );
  }
}

/// Soft breathing glow, e.g. behind the logo or a "live" dot.
class PulseGlow extends StatelessWidget {
  final Widget child;
  final Color color;
  final double maxBlur;

  const PulseGlow({
    super.key,
    required this.child,
    required this.color,
    this.maxBlur = 28,
  });

  @override
  Widget build(BuildContext context) {
    return child
        .animate(onPlay: (c) => c.repeat(reverse: true))
        .custom(
          duration: 1600.ms,
          curve: Curves.easeInOut,
          builder: (_, v, child) => DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.18 + 0.27 * v),
                  blurRadius: maxBlur * (0.5 + 0.5 * v),
                  spreadRadius: 2 * v,
                ),
              ],
            ),
            child: child,
          ),
        );
  }
}

/// Small blinking dot that signals live data.
class LiveDot extends StatelessWidget {
  final Color color;
  final double size;
  const LiveDot({super.key, this.color = const Color(0xFF34D399), this.size = 8});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    )
        .animate(onPlay: (c) => c.repeat(reverse: true))
        .fade(begin: 1, end: 0.35, duration: 900.ms)
        .scaleXY(begin: 1, end: 0.8, duration: 900.ms);
  }
}
