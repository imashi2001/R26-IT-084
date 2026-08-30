import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/providers.dart';
import '../../theme/app_theme.dart';
import '../shared/widgets.dart';
import 'staff_shell.dart';

class StaffAlertsScreen extends ConsumerStatefulWidget {
  const StaffAlertsScreen({super.key});

  @override
  ConsumerState<StaffAlertsScreen> createState() => _StaffAlertsScreenState();
}

class _StaffAlertsScreenState extends ConsumerState<StaffAlertsScreen> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(staffAlertsProvider);
    final countsAsync = ref.watch(alertCountsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const StaffDrawer(),
      appBar: StaffAppBar(
        title: 'Alerts',
        showMenu: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(staffAlertsProvider);
              ref.invalidate(alertCountsProvider);
            },
          ),
        ],
      ),
      body: async.when(
        loading: () => const CentredLoader(label: 'Loading alerts…'),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(staffAlertsProvider),
        ),
        data: (alerts) {
          final critical =
              alerts.where((a) => a.severity == 'critical').length;
          final warning =
              alerts.where((a) => a.severity == 'warning').length;
          final info = alerts.where((a) => a.severity == 'info').length;

          List filtered = alerts;
          if (_filter == 'critical') {
            filtered = alerts.where((a) => a.severity == 'critical').toList();
          } else if (_filter == 'warning') {
            filtered = alerts.where((a) => a.severity == 'warning').toList();
          } else if (_filter == 'info') {
            filtered = alerts.where((a) => a.severity == 'info').toList();
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      FilterPill(
                        label: 'All',
                        count: alerts.length,
                        selected: _filter == 'all',
                        onTap: () => setState(() => _filter = 'all'),
                        activeColor: AppColors.brand,
                      ),
                      const SizedBox(width: 8),
                      FilterPill(
                        label: 'Critical',
                        count: critical,
                        selected: _filter == 'critical',
                        onTap: () => setState(() => _filter = 'critical'),
                        activeColor: AppColors.riskHigh,
                      ),
                      const SizedBox(width: 8),
                      FilterPill(
                        label: 'Warnings',
                        count: warning,
                        selected: _filter == 'warning',
                        onTap: () => setState(() => _filter = 'warning'),
                        activeColor: AppColors.riskMedium,
                      ),
                      const SizedBox(width: 8),
                      FilterPill(
                        label: 'Info',
                        count: info,
                        selected: _filter == 'info',
                        onTap: () => setState(() => _filter = 'info'),
                        activeColor: AppColors.accentBlue,
                      ),
                    ],
                  ),
                ),
              ),
              if (countsAsync.hasValue)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    '${countsAsync.value?['open'] ?? 0} open alerts',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              Expanded(
                child: filtered.isEmpty
                    ? const EmptyHint(message: 'No alerts in this category.')
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) {
                          final alert = filtered[i];
                          return AlertFeedTile(
                            alert: alert,
                            onTap: alert.deviceId != null
                                ? () => context
                                    .push('/staff/bins/${alert.deviceId}')
                                : null,
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
