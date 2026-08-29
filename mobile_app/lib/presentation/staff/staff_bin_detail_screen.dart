import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
        leading: BackButton(onPressed: () => context.pop()),
        title: const Text('Bin detail'),
        actions: [
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
        data: (data) => _Detail(data: data),
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  final BinLatest data;
  const _Detail({required this.data});

  Future<void> _openMaps() async {
    final d = data.device;
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1'
      '&destination=${d.latitude},${d.longitude}'
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

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: data.imageUrl != null
              ? CachedNetworkImage(
                  imageUrl: data.imageUrl!,
                  height: 200,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(
                    height: 200,
                    color: AppColors.surface,
                    child: const CentredLoader(),
                  ),
                  errorWidget: (_, __, ___) => const _ImageFallback(),
                )
              : const _ImageFallback(),
        ),
        const SizedBox(height: 16),
        Text(device.name,
            style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary)),
        if (device.address != null && device.address!.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(device.address!,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.textSecondary)),
        ],
        const SizedBox(height: 16),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(child: _SectionTitle('Fill & risk')),
                  RiskBadge(riskLevel: extras?.riskLevel ?? device.latestRiskLevel),
                ],
              ),
              const SizedBox(height: 12),
              FillMeter(fillLevel: fill, fillPercentage: pct),
              if (extras?.riskCase != null) ...[
                const SizedBox(height: 8),
                _InfoRow('Risk case', extras!.riskCase!),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionTitle('Latest capture'),
              const SizedBox(height: 8),
              _InfoRow('Captured', formatTs(data.capturedAt)),
              if (data.modelName != null) _InfoRow('Model', data.modelName!),
              if (extras?.wasteLabel != null)
                _InfoRow('Waste', extras!.wasteLabel!),
              if (extras?.animalCount != null)
                _InfoRow('Animals', '${extras!.animalCount}'),
              if (extras?.tempC != null)
                _InfoRow(
                    'Temperature', '${extras!.tempC!.toStringAsFixed(1)} °C'),
              if (extras?.humidityPct != null)
                _InfoRow('Humidity', '${extras!.humidityPct!.round()}%'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionTitle('Location'),
              const SizedBox(height: 8),
              _InfoRow('Latitude', device.latitude.toStringAsFixed(5)),
              _InfoRow('Longitude', device.longitude.toStringAsFixed(5)),
              if (device.location != null) _InfoRow('Area', device.location!),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _openMaps,
                  icon: const Icon(Icons.map_outlined, size: 18),
                  label: const Text('Open in Google Maps'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 160,
      width: double.infinity,
      color: AppColors.surface,
      child: const Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.photo_camera_outlined,
              size: 40, color: AppColors.textSecondary),
          SizedBox(height: 8),
          Text('No capture image yet',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: child,
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textSecondary,
          letterSpacing: 0.6),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
