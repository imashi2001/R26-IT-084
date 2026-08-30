import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/providers.dart';
import '../../domain/models.dart';
import '../../theme/app_theme.dart';
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

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const StaffDrawer(),
      appBar: StaffAppBar(
        title: 'VisionWaste Staff',
        subtitle: auth.user?.municipalCouncil,
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
  final String priorityTab;
  final ValueChanged<String> onPriorityTab;
  final ValueChanged<int> onBinTap;
  final Future<void> Function() onRefresh;

  const _DashboardBody({
    required this.bins,
    required this.greeting,
    required this.name,
    required this.priorityTab,
    required this.onPriorityTab,
    required this.onBinTap,
    required this.onRefresh,
  });

  int _count(String tier) =>
      bins.where((b) => (b.latestFillLevel ?? '').toLowerCase() == tier).length;

  List<Bin> _priorityBins() {
    final tier = priorityTab;
    return bins
        .where((b) => (b.latestFillLevel ?? '').toLowerCase() == tier)
        .take(8)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final overflow = _count('overflow');
    final half = _count('half');
    final empty = _count('empty');
    final priority = _priorityBins();
    final collected = overflow + half;
    final rate = bins.isEmpty ? 0 : ((empty / bins.length) * 100).round();

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
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: KpiStatCard(
                  label: 'Full (High)',
                  value: '$overflow',
                  color: AppColors.fillOverflow,
                  icon: Icons.delete_outline,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: KpiStatCard(
                  label: 'Half (Med)',
                  value: '$half',
                  color: AppColors.fillHalf,
                  icon: Icons.delete_outline,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: KpiStatCard(
                  label: 'Empty (Low)',
                  value: '$empty',
                  color: AppColors.fillEmpty,
                  icon: Icons.delete_outline,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: KpiStatCard(
                  label: 'Need pickup',
                  value: '${overflow + half}',
                  color: const Color(0xFF8B5CF6),
                  icon: Icons.route_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const SectionTitle('Priority overview'),
          const SizedBox(height: 8),
          SegmentedFilterRow(
            options: const [
              ('overflow', 'Full'),
              ('half', 'Half'),
              ('empty', 'Empty'),
            ],
            selected: priorityTab,
            onSelected: onPriorityTab,
          ),
          const SizedBox(height: 10),
          if (priority.isEmpty)
            const EmptyHint(message: 'No bins in this category.')
          else
            ...priority.map(
              (b) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: PriorityBinTile(
                  bin: b,
                  onTap: () => onBinTap(b.id),
                ),
              ),
            ),
          const SizedBox(height: 16),
          const SectionTitle("Today's summary"),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: SummaryMiniCard(
                  label: 'Total bins',
                  value: '${bins.length}',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SummaryMiniCard(
                  label: 'Need service',
                  value: '$collected',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SummaryMiniCard(
                  label: 'Empty rate',
                  value: '$rate%',
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          StaffCard(
            child: Row(
              children: [
                SizedBox(
                  width: 72,
                  height: 72,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox(
                        width: 72,
                        height: 72,
                        child: CircularProgressIndicator(
                          value: bins.isEmpty ? 0 : empty / bins.length,
                          strokeWidth: 8,
                          backgroundColor: AppColors.card,
                          color: AppColors.brand,
                        ),
                      ),
                      Text(
                        '$rate%',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Fleet status',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$empty empty · $half half · $overflow full',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
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
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
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
            months[date.month - 1],
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
