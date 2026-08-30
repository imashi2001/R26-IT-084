import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/providers.dart';
import '../../domain/models.dart';
import '../../theme/app_theme.dart';
import '../shared/staff_charts.dart';
import '../shared/widgets.dart';
import 'staff_shell.dart';

class StaffDashboardScreen extends ConsumerStatefulWidget {
  const StaffDashboardScreen({super.key});

  @override
  ConsumerState<StaffDashboardScreen> createState() =>
      _StaffDashboardScreenState();
}

class _StaffDashboardScreenState extends ConsumerState<StaffDashboardScreen> {
  String _priorityTab = 'overflow';

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final async = ref.watch(mapBinsProvider);
    final name = auth.user?.name ?? 'Staff';
    final greeting = _greeting();
    final binsForRoutes = async.valueOrNull ?? [];
    final needService = binsForRoutes.where((b) {
      final l = (b.latestFillLevel ?? '').toLowerCase();
      return l == 'overflow' || l == 'half';
    }).length;
    final routeCount =
        needService == 0 ? 1 : (needService / 8).ceil().clamp(1, 12);

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const StaffDrawer(),
      appBar: StaffAppBar(
        title: 'VisionWaste',
        subtitle: auth.user?.municipalCouncil,
        showBrand: true,
      ),
      body: async.when(
        loading: () => const CentredLoader(label: 'Loading dashboard…'),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(mapBinsProvider),
        ),
        data: (bins) => _DashboardBody(
          bins: bins,
          greeting: greeting,
          name: name,
          routeCount: routeCount,
          priorityTab: _priorityTab,
          onPriorityTab: (t) => setState(() => _priorityTab = t),
          onBinTap: (id) => context.push('/staff/bins/$id'),
          onRefresh: () async {
            ref.invalidate(mapBinsProvider);
          },
        ),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
}

class _DashboardBody extends StatelessWidget {
  final List<Bin> bins;
  final String greeting;
  final String name;
  final int routeCount;
  final String priorityTab;
  final ValueChanged<String> onPriorityTab;
  final ValueChanged<int> onBinTap;
  final Future<void> Function() onRefresh;

  const _DashboardBody({
    required this.bins,
    required this.greeting,
    required this.name,
    required this.routeCount,
    required this.priorityTab,
    required this.onPriorityTab,
    required this.onBinTap,
    required this.onRefresh,
  });

  int _count(String tier) =>
      bins.where((b) => (b.latestFillLevel ?? '').toLowerCase() == tier).length;

  List<Bin> _priorityBins() {
    return bins
        .where((b) => (b.latestFillLevel ?? '').toLowerCase() == priorityTab)
        .take(8)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final overflow = _count('overflow');
    final half = _count('half');
    final empty = _count('empty');
    final priority = _priorityBins();
    final needService = overflow + half;
    final completion =
        bins.isEmpty ? 0 : ((bins.length - needService) / bins.length * 100).round();
    final estDistance = (needService * 3.2).toStringAsFixed(1);

    return RefreshIndicator(
      color: AppColors.brand,
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$greeting,',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              _DateChip(date: DateTime.now()),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 118,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                KpiStatCard(
                  label: 'Full (High)',
                  value: '$overflow',
                  color: AppColors.fillOverflow,
                  icon: Icons.error_outline,
                ),
                const SizedBox(width: 10),
                KpiStatCard(
                  label: 'Half (Medium)',
                  value: '$half',
                  color: AppColors.fillHalf,
                  icon: Icons.trending_up,
                ),
                const SizedBox(width: 10),
                KpiStatCard(
                  label: 'Empty (Low)',
                  value: '$empty',
                  color: AppColors.fillEmpty,
                  icon: Icons.check_circle_outline,
                ),
                const SizedBox(width: 10),
                KpiStatCard(
                  label: 'Routes Today',
                  value: '$routeCount',
                  color: AppColors.accentPurple,
                  icon: Icons.calendar_today_outlined,
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const SectionTitle('Priority overview'),
          const SizedBox(height: 10),
          SegmentedFilterRow(
            options: const [
              ('overflow', 'Full'),
              ('half', 'Half'),
              ('empty', 'Empty'),
            ],
            selected: priorityTab,
            onSelected: onPriorityTab,
            accentById: const {
              'overflow': AppColors.fillOverflow,
              'half': AppColors.fillHalf,
              'empty': AppColors.fillEmpty,
            },
          ),
          const SizedBox(height: 12),
          if (priority.isEmpty)
            const EmptyHint(message: 'No bins in this category.')
          else
            ...priority.map(
              (b) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: PriorityBinTile(
                  bin: b,
                  onTap: () => onBinTap(b.id),
                ),
              ),
            ),
          const SizedBox(height: 18),
          const SectionTitle("Today's summary"),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: SummaryMiniCard(
                  label: 'Total Bins',
                  value: '${bins.length}',
                  icon: Icons.delete_outline,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SummaryMiniCard(
                  label: 'Routes',
                  value: '$routeCount',
                  icon: Icons.route_outlined,
                  accent: AppColors.accentPurple,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SummaryMiniCard(
                  label: 'Est. Distance',
                  value: '$estDistance km',
                  icon: Icons.straighten,
                  accent: AppColors.accentBlue,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          StaffCard(
            child: Row(
              children: [
                DonutChart(
                  value: completion / 100,
                  size: 92,
                  centerLabel: '$completion%',
                  centerSub: 'done',
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Collection performance',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$completion% completion rate',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      _PerfStatRow(
                        icon: Icons.delete_sweep_outlined,
                        label: 'Bins serviced',
                        value: '$empty',
                      ),
                      const SizedBox(height: 6),
                      _PerfStatRow(
                        icon: Icons.route_outlined,
                        label: 'Need pickup',
                        value: '$needService',
                      ),
                      const SizedBox(height: 6),
                      _PerfStatRow(
                        icon: Icons.straighten,
                        label: 'Est. distance',
                        value: '$estDistance km',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PerfStatRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _PerfStatRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.textMuted),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _DateChip extends StatelessWidget {
  final DateTime date;
  const _DateChip({required this.date});

  @override
  Widget build(BuildContext context) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: AppColors.glassCard(tint: AppColors.brand.withValues(alpha: 0.08)),
      child: Column(
        children: [
          Text(
            '${date.day}',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.brand,
            ),
          ),
          Text(
            '${months[date.month - 1]} ${date.year}',
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
