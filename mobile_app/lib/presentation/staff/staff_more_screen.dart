import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/providers.dart';
import '../../theme/app_theme.dart';
import '../shared/widgets.dart';
import 'staff_shell.dart';

class StaffMoreScreen extends ConsumerWidget {
  const StaffMoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const StaffDrawer(),
      appBar: const StaffAppBar(title: 'More'),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          StaffCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppColors.brand.withValues(alpha: 0.15),
                  child: Text(
                    (user?.name ?? 'S')[0].toUpperCase(),
                    style: const TextStyle(
                      color: AppColors.brand,
                      fontWeight: FontWeight.w800,
                      fontSize: 22,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.name ?? 'Staff user',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        user?.email ?? '',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      if (user?.municipalCouncil != null)
                        Text(
                          user!.municipalCouncil!,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _MenuTile(
            icon: Icons.dashboard_outlined,
            label: 'Dashboard',
            onTap: () => context.go('/staff/dashboard'),
          ),
          _MenuTile(
            icon: Icons.delete_outline,
            label: 'Bin registry',
            onTap: () => context.go('/staff/bins'),
          ),
          _MenuTile(
            icon: Icons.route_outlined,
            label: 'Collection routes',
            onTap: () => context.go('/staff/routes'),
          ),
          _MenuTile(
            icon: Icons.notifications_outlined,
            label: 'Alerts',
            onTap: () => context.go('/staff/alerts'),
          ),
          const SizedBox(height: 16),
          const SectionTitle('Account'),
          const SizedBox(height: 8),
          _MenuTile(
            icon: Icons.logout,
            label: 'Sign out',
            destructive: true,
            onTap: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/');
            },
          ),
          const SizedBox(height: 24),
          const Text(
            'VisionWaste Staff v1.0.0',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;

  const _MenuTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = destructive ? AppColors.riskHigh : AppColors.textPrimary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            decoration: AppColors.glassCard(),
            child: ListTile(
              leading: Icon(icon, color: color),
              title: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
              trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ),
      ),
    );
  }
}
