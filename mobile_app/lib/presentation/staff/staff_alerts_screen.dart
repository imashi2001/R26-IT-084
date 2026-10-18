import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/bin_repository.dart';
import '../../data/providers.dart';
import '../../domain/models.dart';
import '../../theme/app_theme.dart';
import '../shared/motion.dart';
import '../shared/widgets.dart';
import 'staff_shell.dart';

const _statusTabs = [
  ('open', 'Open'),
  ('seen', 'Seen'),
  ('done', 'Resolved'),
  ('all', 'All'),
];

bool _matchesTab(String status, String tab) {
  switch (tab) {
    case 'open':
      return status == 'open';
    case 'seen':
      return status == 'acknowledged';
    case 'done':
      return status == 'actioned' || status == 'dismissed' || status == 'rejected';
    default:
      return true;
  }
}

class StaffAlertsScreen extends ConsumerStatefulWidget {
  const StaffAlertsScreen({super.key});

  @override
  ConsumerState<StaffAlertsScreen> createState() => _StaffAlertsScreenState();
}

class _StaffAlertsScreenState extends ConsumerState<StaffAlertsScreen> {
  String _tab = 'open';
  String _severity = 'all';

  /// Status changes made in this session (applied on top of fetched data
  /// so the list updates instantly).
  final Map<int, String> _overrides = {};

  String _statusOf(StaffAlert a) => _overrides[a.id] ?? a.status;

  Future<bool> _setStatus(StaffAlert alert, String status) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await BinRepository.instance.updateAlertStatus(alert.id, status);
      HapticFeedback.mediumImpact();
      setState(() => _overrides[alert.id] = status);
      ref.invalidate(alertCountsProvider);
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            status == 'acknowledged'
                ? 'Marked as seen'
                : status == 'actioned'
                    ? 'Alert resolved'
                    : 'Alert updated',
          ),
          action: SnackBarAction(
            label: 'Undo',
            textColor: AppColors.brandGlow,
            onPressed: () async {
              try {
                await BinRepository.instance
                    .updateAlertStatus(alert.id, alert.status);
                if (mounted) setState(() => _overrides.remove(alert.id));
                ref.invalidate(alertCountsProvider);
              } catch (_) {}
            },
          ),
        ),
      );
      return true;
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(friendlyError(e))));
      return false;
    }
  }

  Future<void> _refresh() async {
    _overrides.clear();
    ref.invalidate(staffAlertsProvider);
    ref.invalidate(alertCountsProvider);
    await ref.read(staffAlertsProvider.future).catchError((_) => <StaffAlert>[]);
  }

  void _openSheet(StaffAlert alert) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AlertSheet(
        alert: alert,
        status: _statusOf(alert),
        onStatus: (s) async {
          Navigator.of(context).pop();
          await _setStatus(alert, s);
        },
        onViewBin: alert.deviceId == null
            ? null
            : () {
                Navigator.of(context).pop();
                context.push('/staff/bins/${alert.deviceId}');
              },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(staffAlertsProvider);
    final alerts = async.valueOrNull ?? const <StaffAlert>[];
    final openCount = alerts.where((a) => _statusOf(a) == 'open').length;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            StaffHeader(
              title: 'Alerts',
              subtitle: async.isLoading && alerts.isEmpty
                  ? 'Loading…'
                  : '$openCount open · swipe to act',
              showBell: false,
            ),
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _StatusTabs(
                selected: _tab,
                counts: {
                  for (final (id, _) in _statusTabs)
                    id: alerts.where((a) => _matchesTab(_statusOf(a), id)).length,
                },
                onChanged: (t) => setState(() => _tab = t),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.only(left: 20),
              child: SegmentedFilterRow(
                options: const [
                  ('all', 'All'),
                  ('critical', 'Critical'),
                  ('warning', 'Warning'),
                  ('info', 'Info'),
                ],
                selected: _severity,
                onSelected: (v) => setState(() => _severity = v),
                accentById: const {
                  'critical': AppColors.riskHigh,
                  'warning': AppColors.riskMedium,
                  'info': AppColors.accentBlue,
                },
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: async.when(
                loading: () => const SkeletonList(count: 5, itemHeight: 104),
                error: (e, _) => ErrorState(
                  message: friendlyError(e),
                  onRetry: _refresh,
                ),
                data: (_) => _buildList(alerts),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList(List<StaffAlert> alerts) {
    final filtered = alerts
        .where((a) => _matchesTab(_statusOf(a), _tab))
        .where((a) => _severity == 'all' || a.severity == _severity)
        .toList();

    if (filtered.isEmpty) {
      return RefreshIndicator(
        color: AppColors.brand,
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const SizedBox(height: 40),
            EmptyHint(
              icon: _tab == 'open'
                  ? Icons.verified_rounded
                  : Icons.notifications_off_rounded,
              title: _tab == 'open' ? "You're all caught up" : 'Nothing here',
              message: _tab == 'open'
                  ? 'No open alerts. New ones appear here automatically.'
                  : 'No alerts match this filter.',
            ),
          ],
        ),
      );
    }

    final groups = <String, List<StaffAlert>>{};
    for (final a in filtered) {
      groups.putIfAbsent(_dayLabel(a.createdAt), () => []).add(a);
    }

    var index = 0;
    return RefreshIndicator(
      color: AppColors.brand,
      backgroundColor: AppColors.surface,
      onRefresh: _refresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, kNavBarClearance),
        children: [
          for (final entry in groups.entries) ...[
            Padding(
              padding: const EdgeInsets.only(top: 10, bottom: 10, left: 4),
              child: Text(entry.key.toUpperCase(), style: AppText.overline),
            ),
            for (final a in entry.value)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _SwipeableAlert(
                  key: ValueKey('alert-${a.id}-${_statusOf(a)}'),
                  alert: a,
                  status: _statusOf(a),
                  removeOnAction: _tab != 'all',
                  onAction: (s) => _setStatus(a, s),
                  onTap: () => _openSheet(a),
                ).entrance(index: index++),
              ),
          ],
        ],
      ),
    );
  }

  String _dayLabel(String? iso) {
    if (iso == null) return 'Earlier';
    final t = DateTime.tryParse(iso)?.toLocal();
    if (t == null) return 'Earlier';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(t.year, t.month, t.day);
    final diff = today.difference(day).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    if (diff < 7) return 'This week';
    return 'Earlier';
  }
}

class _StatusTabs extends StatelessWidget {
  final String selected;
  final Map<String, int> counts;
  final ValueChanged<String> onChanged;

  const _StatusTabs({
    required this.selected,
    required this.counts,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          for (final (id, label) in _statusTabs)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(id),
                child: AnimatedContainer(
                  duration: Motion.medium,
                  curve: Motion.curve,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    gradient: selected == id ? AppGradients.brand : null,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    children: [
                      Text(
                        '${counts[id] ?? 0}',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: selected == id
                              ? Colors.white
                              : AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: selected == id
                              ? Colors.white.withValues(alpha: 0.9)
                              : AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SwipeableAlert extends StatelessWidget {
  final StaffAlert alert;
  final String status;
  final bool removeOnAction;
  final Future<bool> Function(String status) onAction;
  final VoidCallback onTap;

  const _SwipeableAlert({
    super.key,
    required this.alert,
    required this.status,
    required this.removeOnAction,
    required this.onAction,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final shown = StaffAlert(
      id: alert.id,
      severity: alert.severity,
      title: alert.title,
      summary: alert.summary,
      status: status,
      deviceId: alert.deviceId,
      deviceName: alert.deviceName,
      createdAt: alert.createdAt,
    );
    final canSee = status == 'open';
    final canResolve = status == 'open' || status == 'acknowledged';

    if (!canSee && !canResolve) {
      return AlertFeedTile(alert: shown, onTap: onTap);
    }

    return Dismissible(
      key: ValueKey('dismiss-${alert.id}-$status'),
      direction: canSee
          ? DismissDirection.horizontal
          : DismissDirection.endToStart,
      background: const _SwipeBackground(
        color: AppColors.accentBlue,
        icon: Icons.visibility_rounded,
        label: 'Mark seen',
        alignLeft: true,
      ),
      secondaryBackground: const _SwipeBackground(
        color: AppColors.brand,
        icon: Icons.task_alt_rounded,
        label: 'Resolve',
        alignLeft: false,
      ),
      confirmDismiss: (dir) async {
        final next = dir == DismissDirection.startToEnd
            ? 'acknowledged'
            : 'actioned';
        final ok = await onAction(next);
        return ok && removeOnAction;
      },
      child: AlertFeedTile(alert: shown, onTap: onTap),
    );
  }
}

class _SwipeBackground extends StatelessWidget {
  final Color color;
  final IconData icon;
  final String label;
  final bool alignLeft;

  const _SwipeBackground({
    required this.color,
    required this.icon,
    required this.label,
    required this.alignLeft,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      alignment: alignLeft ? Alignment.centerLeft : Alignment.centerRight,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: LinearGradient(
          begin: alignLeft ? Alignment.centerLeft : Alignment.centerRight,
          end: alignLeft ? Alignment.centerRight : Alignment.centerLeft,
          colors: [color, color.withValues(alpha: 0.15)],
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white),
          const SizedBox(width: 8),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _AlertSheet extends StatelessWidget {
  final StaffAlert alert;
  final String status;
  final ValueChanged<String> onStatus;
  final VoidCallback? onViewBin;

  const _AlertSheet({
    required this.alert,
    required this.status,
    required this.onStatus,
    this.onViewBin,
  });

  @override
  Widget build(BuildContext context) {
    final color = alertColor(alert.severity);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                IconTile(icon: alertIcon(alert), color: color, size: 54),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(alert.title, style: AppText.h2),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 6,
                        children: [
                          StatusPill(
                            label: alert.severity.toUpperCase(),
                            color: color,
                          ),
                          StatusPill(
                            label: alertStatusLabel(status),
                            color: AppColors.textSecondary,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            if (alert.summary != null)
              Text(alert.summary!, style: AppText.body.copyWith(fontSize: 14)),
            const SizedBox(height: 14),
            Row(
              children: [
                const Icon(Icons.schedule_rounded,
                    size: 16, color: AppColors.textMuted),
                const SizedBox(width: 6),
                Text(formatTs(alert.createdAt), style: AppText.caption),
                if (alert.deviceId != null) ...[
                  const SizedBox(width: 14),
                  const Icon(Icons.delete_outline_rounded,
                      size: 16, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Text(
                    alert.deviceName ?? binCode(alert.deviceId!),
                    style: AppText.caption,
                  ),
                ],
              ],
            ),
            const SizedBox(height: 24),
            if (status == 'open' || status == 'acknowledged')
              GlowPrimaryButton(
                label: 'Resolve alert',
                icon: Icons.task_alt_rounded,
                onPressed: () => onStatus('actioned'),
              ),
            if (status == 'open') ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => onStatus('acknowledged'),
                icon: const Icon(Icons.visibility_rounded, size: 18),
                label: const Text('Mark as seen'),
              ),
            ],
            if (status != 'open') ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => onStatus('open'),
                icon: const Icon(Icons.replay_rounded, size: 18),
                label: const Text('Reopen'),
              ),
            ],
            if (onViewBin != null) ...[
              const SizedBox(height: 4),
              TextButton.icon(
                onPressed: onViewBin,
                icon: const Icon(Icons.open_in_new_rounded, size: 18),
                label: const Text('View bin details'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
