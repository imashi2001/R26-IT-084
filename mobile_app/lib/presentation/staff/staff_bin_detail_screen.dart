import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../config/map_layers.dart';
import '../../data/providers.dart';
import '../../domain/models.dart';
import '../../domain/navigation_args.dart';
import '../../services/google_maps_launcher.dart';
import '../../theme/app_theme.dart';
import '../shared/staff_charts.dart';
import '../shared/widgets.dart';
import 'staff_shell.dart';

class StaffBinDetailScreen extends ConsumerWidget {
  final int binId;
  const StaffBinDetailScreen({super.key, required this.binId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(binDetailProvider(binId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: StaffAppBar(
        title: 'Bin Details',
        showMenu: false,
        showBack: true,
        onBack: () {
          if (context.canPop()) {
            context.pop();
          } else {
            context.go('/staff/bins');
          }
        },
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(binDetailProvider(binId)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const CentredLoader(label: 'Loading detail…'),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(binDetailProvider(binId)),
        ),
        data: (data) => _DetailBody(data: data),
      ),
    );
  }
}

class _DetailBody extends StatelessWidget {
  final BinLatest data;
  const _DetailBody({required this.data});

  void _startInAppNavigation(BuildContext context, Bin device) {
    context.push(
      '/navigate',
      extra: InAppNavigationArgs(
        title: 'Navigate to ${binCode(device.id)}',
        waypoints: [
          NavWaypoint(
            latitude: device.latitude,
            longitude: device.longitude,
            label: binCode(device.id),
            subtitle: device.address ?? device.location ?? device.name,
          ),
        ],
        darkMap: true,
      ),
    );
  }

  Future<void> _openGoogleMaps(BuildContext context, Bin device) async {
    final ok = await openGoogleMapsDriving(
      destLat: device.latitude,
      destLng: device.longitude,
    );
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open Google Maps')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final device = data.device;
    final extras = data.extras;
    final fill = data.fillLevel ?? device.latestFillLevel;
    final pct = extras?.fillPercentage ?? device.latestFillPercentage;
    final color = fillColor(fill);
    final pctLabel = pct != null ? '${pct.round()}%' : fillLabel(fill);
    final spark = sparklineFromFill(fill, pct);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        StaffCard(
          tint: color.withValues(alpha: 0.08),
          child: Column(
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: color.withValues(alpha: 0.25),
                      blurRadius: 16,
                    ),
                  ],
                ),
                child: Icon(Icons.delete_outline, color: color, size: 36),
              ),
              const SizedBox(height: 14),
              Text(
                binCode(device.id),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                device.address ?? device.location ?? device.name,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(100),
                  border: Border.all(color: color.withValues(alpha: 0.5)),
                ),
                child: Text(
                  '$pctLabel Full',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
        ),
        if ((data.imageUrl ?? device.latestImageUrl) != null) ...[
          const SizedBox(height: 12),
          StaffCard(
            child: LastCapturePhoto(
              imageUrl: data.imageUrl ?? device.latestImageUrl,
              height: 200,
              capturedAt: data.capturedAt ?? device.latestCapturedAt,
            ),
          ),
        ],
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.25,
          children: [
            _StatGridTile(
              label: 'Fill level',
              value: pctLabel,
              icon: Icons.water_drop_outlined,
              color: color,
              sparkline: spark,
            ),
            _StatGridTile(
              label: 'Status',
              value: fillLabel(fill),
              icon: Icons.warning_amber_outlined,
              color: color,
            ),
            _StatGridTile(
              label: 'Last updated',
              value: timeAgo(data.capturedAt ?? device.latestCapturedAt),
              icon: Icons.schedule,
              color: AppColors.textSecondary,
            ),
            _StatGridTile(
              label: 'Bin type',
              value: device.latestSourceType ?? 'General Waste',
              icon: Icons.category_outlined,
              color: AppColors.brand,
            ),
          ],
        ),
        const SizedBox(height: 12),
        StaffCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionTitle('Location'),
              const SizedBox(height: 8),
              Text(
                '${device.latitude.toStringAsFixed(5)}, ${device.longitude.toStringAsFixed(5)}',
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  height: 140,
                  child: FlutterMap(
                    options: MapOptions(
                      initialCenter: LatLng(device.latitude, device.longitude),
                      initialZoom: 15,
                      interactionOptions:
                          const InteractionOptions(flags: InteractiveFlag.none),
                    ),
                    children: [
                      visionWasteTileLayer(dark: true),
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: LatLng(device.latitude, device.longitude),
                            width: 36,
                            height: 36,
                            child: Icon(Icons.location_on, color: color, size: 36),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        if (extras?.riskLevel != null) ...[
          const SizedBox(height: 12),
          StaffCard(
            child: Row(
              children: [
                const Text('Risk: ', style: TextStyle(color: AppColors.textSecondary)),
                RiskBadge(riskLevel: extras!.riskLevel),
              ],
            ),
          ),
        ],
        if (extras?.litteringEventDetected == true) ...[
          const SizedBox(height: 12),
          StaffCard(
            child: Row(
              children: [
                const Icon(Icons.report_outlined, color: AppColors.riskMedium, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Littering detected'
                    '${extras?.litteringMaxConfidence != null ? ' (${(extras!.litteringMaxConfidence! * 100).round()}%)' : ''}'
                    '${extras?.litteringEventCount != null ? ' · ${extras!.litteringEventCount} event(s)' : ''}',
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 20),
        GlowPrimaryButton(
          label: 'Start in-app navigation',
          icon: Icons.navigation_outlined,
          onPressed: () => _startInAppNavigation(context, device),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => _openGoogleMaps(context, device),
          icon: const Icon(Icons.map_outlined),
          label: const Text('Open in Google Maps'),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => context.go('/staff/routes'),
          icon: const Icon(Icons.add_road_outlined),
          label: const Text('Add to collection route'),
        ),
        const SizedBox(height: 10),
        TextButton.icon(
          onPressed: () => context.go('/staff/alerts'),
          icon: const Icon(Icons.bar_chart_outlined, size: 18),
          label: const Text('View History'),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _StatGridTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final List<double>? sparkline;

  const _StatGridTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.sparkline,
  });

  @override
  Widget build(BuildContext context) {
    return StaffCard(
      padding: const EdgeInsets.all(12),
      tint: color.withValues(alpha: 0.06),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 18),
              const Spacer(),
              if (sparkline != null)
                Expanded(
                  flex: 2,
                  child: SparklineChart(points: sparkline!, color: color),
                ),
            ],
          ),
          const Spacer(),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: color,
            ),
          ),
          Text(
            label,
            style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}
