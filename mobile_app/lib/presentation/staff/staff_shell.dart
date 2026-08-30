import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/providers.dart';
import '../../theme/app_theme.dart';

class StaffShell extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const StaffShell({super.key, required this.navigationShell});

  static const _tabs = [
    _TabItem(Icons.dashboard_outlined, Icons.dashboard, 'Dashboard', '/staff/dashboard'),
    _TabItem(Icons.delete_outline, Icons.delete, 'Bins', '/staff/bins'),
    _TabItem(Icons.route_outlined, Icons.route, 'Routes', '/staff/routes'),
    _TabItem(Icons.notifications_outlined, Icons.notifications, 'Alerts', '/staff/alerts'),
    _TabItem(Icons.more_horiz, Icons.more_horiz, 'More', '/staff/more'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alertAsync = ref.watch(alertCountsProvider);
    final openCount = alertAsync.maybeWhen(
      data: (c) => (c['open'] ?? 0) + (c['acknowledged'] ?? 0),
      orElse: () => 0,
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) {
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          );
        },
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.brand.withValues(alpha: 0.18),
        destinations: [
          for (var i = 0; i < _tabs.length; i++)
            NavigationDestination(
              icon: i == 3 && openCount > 0
                  ? Badge(
                      label: Text('$openCount'),
                      child: Icon(_tabs[i].icon),
                    )
                  : Icon(_tabs[i].icon),
              selectedIcon: Icon(_tabs[i].selectedIcon, color: AppColors.brand),
              label: _tabs[i].label,
            ),
        ],
      ),
    );
  }
}

class _TabItem {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final String path;
  const _TabItem(this.icon, this.selectedIcon, this.label, this.path);
}

/// Shared staff app bar matching mockup header.
class StaffAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final bool showMenu;
  final bool showBack;
  final VoidCallback? onBack;

  const StaffAppBar({
    super.key,
    required this.title,
    this.subtitle,
    this.actions,
    this.showMenu = true,
    this.showBack = false,
    this.onBack,
  });

  @override
  Size get preferredSize => Size.fromHeight(subtitle != null ? 72 : kToolbarHeight);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final alertAsync = ref.watch(alertCountsProvider);
    final badge = alertAsync.maybeWhen(
      data: (c) => (c['open'] ?? 0),
      orElse: () => 0,
    );

    return AppBar(
      backgroundColor: AppColors.background,
      surfaceTintColor: Colors.transparent,
      leading: showBack
          ? IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: onBack ?? () => context.pop(),
            )
          : showMenu
              ? IconButton(
                  icon: const Icon(Icons.menu),
                  onPressed: () => Scaffold.of(context).openDrawer(),
                )
              : null,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          if (subtitle != null)
            Text(
              subtitle!,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
        ],
      ),
      actions: [
        ...?actions,
        IconButton(
          tooltip: 'Alerts',
          onPressed: () => context.go('/staff/alerts'),
          icon: Badge(
            isLabelVisible: badge > 0,
            label: Text('$badge'),
            child: const Icon(Icons.notifications_outlined),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: CircleAvatar(
            radius: 16,
            backgroundColor: AppColors.card,
            child: Text(
              (auth.user?.name ?? 'S')[0].toUpperCase(),
              style: const TextStyle(
                color: AppColors.brand,
                fontWeight: FontWeight.w800,
                fontSize: 13,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class StaffDrawer extends ConsumerWidget {
  const StaffDrawer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    return Drawer(
      backgroundColor: AppColors.surface,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'VisionWaste Staff',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.brand,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    auth.user?.name ?? auth.user?.email ?? 'Staff',
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.dashboard_outlined),
              title: const Text('Dashboard'),
              onTap: () {
                Navigator.pop(context);
                context.go('/staff/dashboard');
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline),
              title: const Text('Bins'),
              onTap: () {
                Navigator.pop(context);
                context.go('/staff/bins');
              },
            ),
            ListTile(
              leading: const Icon(Icons.route_outlined),
              title: const Text('Routes'),
              onTap: () {
                Navigator.pop(context);
                context.go('/staff/routes');
              },
            ),
            ListTile(
              leading: const Icon(Icons.notifications_outlined),
              title: const Text('Alerts'),
              onTap: () {
                Navigator.pop(context);
                context.go('/staff/alerts');
              },
            ),
            const Spacer(),
            ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Sign out'),
              onTap: () async {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go('/');
              },
            ),
          ],
        ),
      ),
    );
  }
}
