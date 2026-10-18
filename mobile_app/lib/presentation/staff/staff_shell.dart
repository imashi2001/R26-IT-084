import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/providers.dart';
import '../../theme/app_theme.dart';
import '../shared/motion.dart';
import '../shared/widgets.dart';

/// Bottom padding staff screens add so content scrolls clear of the floating
/// navigation bar.
const double kNavBarClearance = 116;

class StaffShell extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const StaffShell({super.key, required this.navigationShell});

  static const _tabs = [
    _TabItem(Icons.space_dashboard_outlined, Icons.space_dashboard_rounded, 'Home'),
    _TabItem(Icons.delete_outline_rounded, Icons.delete_rounded, 'Bins'),
    _TabItem(Icons.route_outlined, Icons.route_rounded, 'Routes'),
    _TabItem(Icons.notifications_none_rounded, Icons.notifications_rounded, 'Alerts'),
    _TabItem(Icons.person_outline_rounded, Icons.person_rounded, 'Profile'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final openCount = ref.watch(alertCountsProvider).maybeWhen(
          data: (c) => c['open'] ?? 0,
          orElse: () => 0,
        );

    return Scaffold(
      backgroundColor: AppColors.background,
      extendBody: true,
      body: navigationShell,
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(14, 0, 14, 12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(30),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: Container(
              height: 72,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                color: AppColors.surfaceElevated.withValues(alpha: 0.82),
                borderRadius: BorderRadius.circular(30),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Row(
                children: [
                  for (var i = 0; i < _tabs.length; i++)
                    Expanded(
                      flex: i == navigationShell.currentIndex ? 2 : 1,
                      child: _NavButton(
                        item: _tabs[i],
                        selected: i == navigationShell.currentIndex,
                        badge: i == 3 ? openCount : 0,
                        onTap: () {
                          HapticFeedback.selectionClick();
                          navigationShell.goBranch(
                            i,
                            initialLocation: i == navigationShell.currentIndex,
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  final _TabItem item;
  final bool selected;
  final int badge;
  final VoidCallback onTap;

  const _NavButton({
    required this.item,
    required this.selected,
    required this.badge,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Center(
          child: AnimatedContainer(
            duration: Motion.medium,
            curve: Motion.curve,
            padding: EdgeInsets.symmetric(
              horizontal: selected ? 14 : 0,
              vertical: 10,
            ),
            decoration: BoxDecoration(
              gradient: selected ? AppGradients.brand : null,
              borderRadius: BorderRadius.circular(100),
              boxShadow:
                  selected ? AppShadows.glow(AppColors.brand, strength: 0.4) : null,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Badge(
                  isLabelVisible: badge > 0,
                  backgroundColor: AppColors.riskHigh,
                  label: Text('$badge'),
                  child: Icon(
                    selected ? item.selectedIcon : item.icon,
                    size: 23,
                    color: selected ? Colors.white : AppColors.textSecondary,
                  ),
                ),
                AnimatedSize(
                  duration: Motion.medium,
                  curve: Motion.curve,
                  child: selected
                      ? Padding(
                          padding: const EdgeInsets.only(left: 7),
                          child: Text(
                            item.label,
                            maxLines: 1,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabItem {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  const _TabItem(this.icon, this.selectedIcon, this.label);
}

/// VisionWaste brand mark.
class VisionWasteLogo extends StatelessWidget {
  final double size;
  const VisionWasteLogo({super.key, this.size = 30});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            gradient: AppGradients.brand,
            borderRadius: BorderRadius.circular(size * 0.32),
            boxShadow: AppShadows.glow(AppColors.brand, strength: 0.3),
          ),
          child: Icon(Icons.eco_rounded, color: Colors.white, size: size * 0.6),
        ),
        const SizedBox(width: 8),
        const Text(
          'VisionWaste',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
            letterSpacing: -0.3,
          ),
        ),
      ],
    );
  }
}

/// Initials avatar with a gradient ring.
class UserAvatar extends ConsumerWidget {
  final double size;
  const UserAvatar({super.key, this.size = 40});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = ref.watch(authProvider).user?.name ?? 'Staff';
    final initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((p) => p[0].toUpperCase())
        .join();
    return Container(
      width: size,
      height: size,
      padding: const EdgeInsets.all(2),
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: AppGradients.brand,
      ),
      child: Container(
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.surfaceElevated,
        ),
        alignment: Alignment.center,
        child: Text(
          initials.isEmpty ? 'S' : initials,
          style: TextStyle(
            color: AppColors.brandGlow,
            fontWeight: FontWeight.w700,
            fontSize: size * 0.34,
          ),
        ),
      ),
    );
  }
}

/// Large-title header used at the top of staff tabs.
class StaffHeader extends ConsumerWidget {
  final String title;
  final String? subtitle;
  final List<Widget> actions;
  final bool showBell;

  const StaffHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actions = const [],
    this.showBell = true,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final badge = ref.watch(alertCountsProvider).maybeWhen(
          data: (c) => c['open'] ?? 0,
          orElse: () => 0,
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (subtitle != null)
                  Text(subtitle!, style: AppText.caption.copyWith(fontSize: 12)),
                Text(title, style: AppText.h1),
              ],
            ),
          ),
          ...actions.expand((a) => [a, const SizedBox(width: 8)]),
          if (showBell)
            GlassIconButton(
              icon: Icons.notifications_none_rounded,
              tooltip: 'Alerts',
              badge: badge,
              size: 44,
              onTap: () => context.go('/staff/alerts'),
            ),
        ],
      ),
    );
  }
}
