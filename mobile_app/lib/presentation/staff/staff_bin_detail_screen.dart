import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/providers.dart';
import '../../domain/models.dart';
import '../../theme/app_theme.dart';
import '../shared/widgets.dart';

class StaffBinDetailScreen extends ConsumerWidget {
  final int binId;
  const StaffBinDetailScreen({super.key, required this.binId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(binDetailProvider(binId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/staff/bins');
            }
          },
        ),
        title: const Text(
          'Bin Details',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
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

  Future<void> _openMaps(Bin device) async {
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1'
      '&destination=${device.latitude},${device.longitude}'
      '&travelmode=driving',
    );
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final device = data.device;
    final extras = data.extras;
    final fill = data.fillLevel ?? device.latestFillLevel;
    final pct = extras?.fillPercentage ?? device.latestFillPercentage;
    final color = fillColor(fill);
    final pctLabel = pct != null ? '${pct.round()}%' : fillLabel(fill);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        StaffCard(
          child: Column(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(Icons.delete_outline, color: color, size: 32),
              ),
              const SizedBox(height: 12),
              Text(
                binCode(device.id),
                style: const TextStyle(
                  fontSize: 20,
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
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(100),
                  border: Border.all(color: color.withValues(alpha: 0.5)),
                ),
                child: Text(
                  '$pctLabel · ${fillLabel(fill)}',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.35,
          children: [
            _StatGridTile(
              label: 'Fill level',
              value: pctLabel,
              icon: Icons.water_drop_outlined,
              color: color,
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
              value: device.latestSourceType ?? 'Smart bin',
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
                  height: 120,
                  child: FlutterMap(
                    options: MapOptions(
                      initialCenter: LatLng(device.latitude, device.longitude),
                      initialZoom: 15,
                      interactionOptions:
                          const InteractionOptions(flags: InteractiveFlag.none),
                    ),
                    children: [
                      TileLayer(
                        urlTemplate:
                            'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                        subdomains: const ['a', 'b', 'c', 'd'],
                        userAgentPackageName: 'com.visionwaste.app',
                      ),
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: LatLng(device.latitude, device.longitude),
                            width: 32,
                            height: 32,
                            child: Icon(Icons.location_on, color: color, size: 32),
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
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: () => _openMaps(device),
          icon: const Icon(Icons.add_road_outlined),
          label: const Text('Navigate to bin'),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => context.go('/staff/routes'),
          icon: const Icon(Icons.route_outlined),
          label: const Text('View collection route'),
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

  const _StatGridTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return StaffCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const Spacer(),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 15,
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
