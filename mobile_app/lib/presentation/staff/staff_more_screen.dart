import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/providers.dart';
import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import '../shared/motion.dart';
import '../shared/widgets.dart';
import 'staff_shell.dart';

/// Pings GET /health so staff can see whether the backend is reachable.
final _healthProvider = FutureProvider.autoDispose<bool>((_) async {
  try {
    final res = await ApiClient.instance.dio.get('/health');
    return res.statusCode == 200;
  } catch (_) {
    return false;
  }
});

class StaffMoreScreen extends ConsumerWidget {
  const StaffMoreScreen({super.key});

  Future<void> _confirmSignOut(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const IconTile(
          icon: Icons.logout_rounded,
          color: AppColors.riskHigh,
          size: 52,
        ),
        title: const Text('Sign out?'),
        content: const Text(
          'You will need to sign in again to see bins, routes and alerts.',
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.riskHigh),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(authProvider.notifier).logout();
      if (context.mounted) context.go('/');
    }
  }

  void _showAbout(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (_) => const SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 0, 24, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              VisionWasteLogo(size: 44),
              SizedBox(height: 16),
              Text(
                'VisionWaste uses AI cameras on smart bins to detect fill levels, '
                'waste types, animals and littering, then plans collection routes '
                'and warns staff before hygiene risks grow.',
                textAlign: TextAlign.center,
                style: AppText.body,
              ),
              SizedBox(height: 16),
              Text('Version 1.1.0 · R26-IT-084', style: AppText.caption),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final bins = ref.watch(mapBinsProvider).valueOrNull ?? const [];
    final openAlerts = ref.watch(alertCountsProvider).maybeWhen(
          data: (c) => c['open'] ?? 0,
          orElse: () => 0,
        );
    final needPickup = bins.where((b) {
      final l = (b.latestFillLevel ?? '').toLowerCase();
      return l == 'overflow' || l == 'half';
    }).length;
    final healthy = ref.watch(_healthProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: ListView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 8, 20, kNavBarClearance),
          children: [
            const Text('Profile', style: AppText.h1).entrance(),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: AppColors.gradientCard(AppGradients.forest, radius: 28)
                  .copyWith(
                border: Border.all(color: AppColors.brand.withValues(alpha: 0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const UserAvatar(size: 64),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user?.name ?? 'Staff user',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.h2,
                            ),
                            Text(
                              user?.email ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body.copyWith(fontSize: 12),
                            ),
                            const SizedBox(height: 6),
                            StatusPill(
                              label: titleCase(user?.role ?? 'staff'),
                              color: AppColors.brandGlow,
                              icon: Icons.verified_user_rounded,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (user?.municipalCouncil != null ||
                      user?.coveredArea != null) ...[
                    const SizedBox(height: 16),
                    const Divider(height: 1),
                    const SizedBox(height: 14),
                    if (user?.municipalCouncil != null)
                      _InfoLine(
                        icon: Icons.account_balance_rounded,
                        text: user!.municipalCouncil!,
                      ),
                    if (user?.coveredArea != null) ...[
                      const SizedBox(height: 8),
                      _InfoLine(
                        icon: Icons.map_rounded,
                        text: user!.coveredArea!,
                      ),
                    ],
                  ],
                ],
              ),
            ).entrance(index: 1),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: SummaryMiniCard(
                    label: 'Bins',
                    value: '${bins.length}',
                    icon: Icons.delete_rounded,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SummaryMiniCard(
                    label: 'Need pickup',
                    value: '$needPickup',
                    icon: Icons.local_shipping_rounded,
                    accent: AppColors.riskMedium,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SummaryMiniCard(
                    label: 'Open alerts',
                    value: '$openAlerts',
                    icon: Icons.notifications_active_rounded,
                    accent: AppColors.accentPurple,
                  ),
                ),
              ],
            ).entrance(index: 2),
            const SizedBox(height: 14),
            StaffCard(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  healthy.when(
                    data: (ok) => LiveDot(
                      color: ok ? AppColors.riskLow : AppColors.riskHigh,
                      size: 10,
                    ),
                    loading: () => const SizedBox(
                      width: 10,
                      height: 10,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    error: (_, __) =>
                        const LiveDot(color: AppColors.riskHigh, size: 10),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          healthy.valueOrNull == false
                              ? 'Server unreachable'
                              : 'All systems operational',
                          style: AppText.title.copyWith(fontSize: 14),
                        ),
                        Text(
                          Uri.parse(kBackendBaseUrl).host,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.caption,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Check again',
                    onPressed: () => ref.invalidate(_healthProvider),
                    icon: const Icon(Icons.refresh_rounded,
                        color: AppColors.textSecondary),
                  ),
                ],
              ),
            ).entrance(index: 3),
            const SizedBox(height: 22),
            const Text('WORKSPACE', style: AppText.overline),
            const SizedBox(height: 10),
            _MenuGroup(
              items: [
                _MenuItem(Icons.space_dashboard_rounded, 'Dashboard',
                    AppColors.brandGlow, () => context.go('/staff/dashboard')),
                _MenuItem(Icons.delete_rounded, 'Bin registry',
                    AppColors.riskMedium, () => context.go('/staff/bins')),
                _MenuItem(Icons.map_rounded, 'Live map', AppColors.accentBlue,
                    () => context.go('/staff/bins?view=map')),
                _MenuItem(Icons.route_rounded, 'Collection routes',
                    AppColors.accentTeal, () => context.go('/staff/routes')),
                _MenuItem(Icons.notifications_rounded, 'Alerts',
                    AppColors.accentPurple, () => context.go('/staff/alerts')),
              ],
            ).entrance(index: 4),
            const SizedBox(height: 22),
            ref.watch(dashboardSettingsProvider).maybeWhen(
                  data: (s) => PromoFooterCard(imageUrl: s.promoImageUrl),
                  orElse: () => const PromoFooterCard(imageUrl: null),
                ).entrance(index: 5),
            const SizedBox(height: 22),
            const Text('APP', style: AppText.overline),
            const SizedBox(height: 10),
            _MenuGroup(
              items: [
                _MenuItem(Icons.near_me_rounded, 'Public bin finder',
                    AppColors.lime, () => context.push('/public')),
                _MenuItem(Icons.info_rounded, 'About VisionWaste',
                    AppColors.textSecondary, () => _showAbout(context)),
                _MenuItem(Icons.logout_rounded, 'Sign out', AppColors.riskHigh,
                    () => _confirmSignOut(context, ref),
                    destructive: true),
              ],
            ).entrance(index: 6),
            const SizedBox(height: 22),
            const Center(
              child: Text('VisionWaste Staff · v1.1.0', style: AppText.caption),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoLine({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.brandGlow),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
          ),
        ),
      ],
    );
  }
}

class _MenuItem {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  final bool destructive;
  const _MenuItem(this.icon, this.label, this.color, this.onTap,
      {this.destructive = false});
}

class _MenuGroup extends StatelessWidget {
  final List<_MenuItem> items;
  const _MenuGroup({required this.items});

  @override
  Widget build(BuildContext context) {
    return StaffCard(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            Pressable(
              onTap: items[i].onTap,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(
                  children: [
                    IconTile(
                      icon: items[i].icon,
                      color: items[i].color,
                      size: 38,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        items[i].label,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: items[i].destructive
                              ? AppColors.riskHigh
                              : AppColors.textPrimary,
                        ),
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded,
                        color: AppColors.textMuted),
                  ],
                ),
              ),
            ),
            if (i < items.length - 1)
              const Divider(height: 1, indent: 66, endIndent: 14),
          ],
        ],
      ),
    );
  }
}
