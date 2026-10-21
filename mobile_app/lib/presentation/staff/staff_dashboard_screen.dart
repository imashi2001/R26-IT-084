import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/providers.dart';
import '../../domain/models.dart';
import '../../theme/app_theme.dart';
import '../shared/motion.dart';
import '../shared/staff_charts.dart';
import '../shared/widgets.dart';
import 'staff_shell.dart';

class StaffDashboardScreen extends ConsumerWidget {
  const StaffDashboardScreen({super.key});

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(mapBinsProvider);
    ref.invalidate(weatherProvider);
    ref.invalidate(cityForecastProvider);
    ref.invalidate(staffAlertsProvider);
    ref.invalidate(alertCountsProvider);
    await ref.read(mapBinsProvider.future).catchError((_) => <Bin>[]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final binsAsync = ref.watch(mapBinsProvider);
    final firstName = (auth.user?.name ?? 'there').split(' ').first;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.brand,
          backgroundColor: AppColors.surface,
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(0, 8, 0, kNavBarClearance),
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            children: [
              _Header(greeting: _greeting(), name: firstName).entrance(),
              const SizedBox(height: 18),
              binsAsync.when(
                loading: () => const _DashboardSkeleton(),
                error: (e, _) => SizedBox(
                  height: 420,
                  child: ErrorState(
                    message: friendlyError(e),
                    onRetry: () => ref.invalidate(mapBinsProvider),
                  ),
                ),
                data: (bins) => _DashboardContent(bins: bins),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends ConsumerWidget {
  final String greeting;
  final String name;
  const _Header({required this.greeting, required this.name});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final badge = ref.watch(alertCountsProvider).maybeWhen(
          data: (c) => c['open'] ?? 0,
          orElse: () => 0,
        );
    final council = ref.watch(authProvider).user?.municipalCouncil;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.go('/staff/more'),
            child: const UserAvatar(size: 48),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$greeting,', style: AppText.body),
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.h1.copyWith(fontSize: 22),
                ),
                if (council != null)
                  Text(
                    council,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.caption,
                  ),
              ],
            ),
          ),
          GlassIconButton(
            icon: Icons.notifications_none_rounded,
            badge: badge,
            tooltip: 'Alerts',
            onTap: () => context.go('/staff/alerts'),
          ),
        ],
      ),
    );
  }
}

class _DashboardContent extends ConsumerWidget {
  final List<Bin> bins;
  const _DashboardContent({required this.bins});

  int _count(String tier) =>
      bins.where((b) => (b.latestFillLevel ?? '').toLowerCase() == tier).length;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final full = _count('overflow');
    final half = _count('half');
    final empty = _count('empty');
    final unknown = bins.length - full - half - empty;
    final openAlerts = ref.watch(alertCountsProvider).maybeWhen(
          data: (c) => c['open'] ?? 0,
          orElse: () => 0,
        );

    final attention = bins
        .where((b) {
          final l = (b.latestFillLevel ?? '').toLowerCase();
          return l == 'overflow' || l == 'half';
        })
        .toList()
      ..sort((a, b) => fillFraction(b.latestFillLevel, b.latestFillPercentage)
          .compareTo(fillFraction(a.latestFillLevel, a.latestFillPercentage)));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _OverviewCard(
            total: bins.length,
            full: full,
            half: half,
            empty: empty,
            unknown: unknown,
          ),
        ).entrance(index: 1),
        const SizedBox(height: 18),
        SizedBox(
          height: 142,
          child: ListView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20),
            clipBehavior: Clip.none,
            children: [
              KpiStatCard(
                label: 'Full bins',
                value: full,
                gradient: AppGradients.danger,
                icon: Icons.warning_rounded,
                onTap: () => context.go('/staff/bins'),
              ),
              const SizedBox(width: 12),
              KpiStatCard(
                label: 'Half full',
                value: half,
                gradient: AppGradients.sunrise,
                icon: Icons.timelapse_rounded,
                onTap: () => context.go('/staff/bins'),
              ),
              const SizedBox(width: 12),
              KpiStatCard(
                label: 'Empty',
                value: empty,
                gradient: AppGradients.fresh,
                icon: Icons.check_circle_rounded,
                onTap: () => context.go('/staff/bins'),
              ),
              const SizedBox(width: 12),
              KpiStatCard(
                label: 'Open alerts',
                value: openAlerts,
                gradient: AppGradients.violet,
                icon: Icons.notifications_active_rounded,
                onTap: () => context.go('/staff/alerts'),
              ),
            ],
          ),
        ).entrance(index: 2),
        const SizedBox(height: 22),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20),
          child: _QuickActions(),
        ).entrance(index: 3),
        const SizedBox(height: 26),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: SectionTitle(
            'Needs attention',
            actionLabel: 'All bins',
            onAction: () => context.go('/staff/bins'),
          ),
        ),
        const SizedBox(height: 12),
        if (attention.isEmpty)
          const EmptyHint(
            icon: Icons.celebration_rounded,
            title: 'All clear!',
            message: 'No bins are half full or overflowing right now.',
          )
        else
          for (var i = 0; i < attention.take(5).length; i++)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: PriorityBinTile(
                bin: attention[i],
                onTap: () => context.push('/staff/bins/${attention[i].id}'),
              ),
            ).entrance(index: 4 + i),
        const SizedBox(height: 14),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20),
          child: _RiskForecastCard(),
        ),
        const SizedBox(height: 26),
        const _LatestAlerts(),
      ],
    );
  }
}

class _OverviewCard extends ConsumerWidget {
  final int total;
  final int full;
  final int half;
  final int empty;
  final int unknown;

  const _OverviewCard({
    required this.total,
    required this.full,
    required this.half,
    required this.empty,
    required this.unknown,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ok = total == 0 ? 0.0 : empty / total;
    final weather = ref.watch(weatherProvider).valueOrNull;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: AppGradients.forest,
        border: Border.all(color: AppColors.brand.withValues(alpha: 0.25)),
        boxShadow: AppShadows.glow(AppColors.brandDark, strength: 0.3),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const LiveDot(),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'City overview · live',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.brandGlow,
                  ),
                ),
              ),
              if (weather?.tempC != null)
                GlassChip(
                  icon: _weatherIcon(weather!.condition),
                  label:
                      '${weather.tempC!.round()}°C${weather.humidityPct != null ? ' · ${weather.humidityPct!.round()}%' : ''}',
                ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              DonutChart(
                value: ok,
                size: 104,
                centerLabel: '${(ok * 100).round()}%',
                centerSub: 'bins OK',
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AnimatedCount(
                      value: total,
                      style: AppText.display.copyWith(fontSize: 36),
                    ),
                    const Text('smart bins monitored', style: AppText.body),
                    const SizedBox(height: 10),
                    StatusPill(
                      label: full + half == 0
                          ? 'Nothing to collect'
                          : '${full + half} need pickup',
                      color: full > 0
                          ? AppColors.riskHigh
                          : half > 0
                              ? AppColors.riskMedium
                              : AppColors.brandGlow,
                      icon: Icons.local_shipping_rounded,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          FillDistributionBar(
            full: full,
            half: half,
            empty: empty,
            unknown: unknown,
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _Legend(color: AppColors.fillOverflow, label: 'Full', value: full),
              _Legend(color: AppColors.fillHalf, label: 'Half', value: half),
              _Legend(color: AppColors.fillEmpty, label: 'Empty', value: empty),
              if (unknown > 0)
                _Legend(
                    color: AppColors.fillUnknown, label: 'No data', value: unknown),
            ],
          ),
        ],
      ),
    );
  }
}

IconData _weatherIcon(String? condition) {
  final c = (condition ?? '').toLowerCase();
  if (c.contains('thunder')) return Icons.thunderstorm_rounded;
  if (c.contains('rain') || c.contains('drizzle')) return Icons.umbrella_rounded;
  if (c.contains('cloud')) return Icons.cloud_rounded;
  if (c.contains('clear') || c.contains('sun')) return Icons.wb_sunny_rounded;
  if (c.contains('mist') || c.contains('fog') || c.contains('haze')) {
    return Icons.foggy;
  }
  return Icons.thermostat_rounded;
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;
  final int value;
  const _Legend({required this.color, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          '$label $value',
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    final actions = [
      (Icons.route_rounded, 'Start route', AppGradients.brand,
          () => context.go('/staff/routes')),
      (Icons.map_rounded, 'Live map', AppGradients.ocean,
          () => context.go('/staff/bins?view=map')),
      (Icons.notifications_active_rounded, 'Alerts', AppGradients.violet,
          () => context.go('/staff/alerts')),
      (Icons.near_me_rounded, 'Nearest', AppGradients.sunrise,
          () => context.push('/public')),
    ];
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        for (final (icon, label, gradient, onTap) in actions)
          Pressable(
            onTap: onTap,
            child: SizedBox(
              width: 74,
              child: Column(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      gradient: gradient,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: AppShadows.glow(
                        gradient.colors.last,
                        strength: 0.3,
                      ),
                    ),
                    child: Icon(icon, color: Colors.white, size: 26),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    maxLines: 1,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary,
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

class _RiskForecastCard extends ConsumerWidget {
  const _RiskForecastCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(cityForecastProvider);
    return StaffCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const IconTile(
                icon: Icons.health_and_safety_rounded,
                color: AppColors.accentTeal,
                size: 40,
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Hygiene risk forecast', style: AppText.title),
                    Text('Next 24 hours · weather-based', style: AppText.caption),
                  ],
                ),
              ),
              if (async.valueOrNull?.maxLevel != null)
                RiskBadge(riskLevel: async.valueOrNull!.maxLevel),
            ],
          ),
          const SizedBox(height: 16),
          async.when(
            loading: () => const SkeletonBox(height: 140),
            error: (e, _) => Text(friendlyError(e), style: AppText.caption),
            data: (f) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RiskForecastChart(slots: f.slots, height: 96),
                if (f.recommendation != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.accentTeal.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.tips_and_updates_rounded,
                            size: 18, color: AppColors.accentTeal),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            f.recommendation!,
                            style: AppText.body.copyWith(fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LatestAlerts extends ConsumerWidget {
  const _LatestAlerts();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts = ref.watch(staffAlertsProvider).valueOrNull ?? const [];
    final recent = alerts.take(3).toList();
    if (recent.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: SectionTitle(
            'Latest alerts',
            actionLabel: 'See all',
            onAction: () => context.go('/staff/alerts'),
          ),
        ),
        const SizedBox(height: 12),
        for (final a in recent)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: AlertFeedTile(
              alert: a,
              onTap: a.deviceId != null
                  ? () => context.push('/staff/bins/${a.deviceId}')
                  : () => context.go('/staff/alerts'),
            ),
          ),
      ],
    );
  }
}

class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          SkeletonBox(height: 250, radius: 28),
          SizedBox(height: 18),
          Row(
            children: [
              Expanded(child: SkeletonBox(height: 140, radius: 22)),
              SizedBox(width: 12),
              Expanded(child: SkeletonBox(height: 140, radius: 22)),
            ],
          ),
          SizedBox(height: 18),
          SkeletonBox(height: 86, radius: 22),
          SizedBox(height: 12),
          SkeletonBox(height: 86, radius: 22),
        ],
      ),
    );
  }
}
