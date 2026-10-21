import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../config/map_layers.dart';
import '../../data/providers.dart';
import '../../domain/models.dart';
import '../../domain/navigation_args.dart';
import '../../services/api_client.dart';
import '../../services/google_maps_launcher.dart';
import '../../theme/app_theme.dart';
import '../shared/illustrations.dart';
import '../shared/motion.dart';
import '../shared/staff_charts.dart';
import '../shared/widgets.dart';

class StaffBinDetailScreen extends ConsumerWidget {
  final int binId;
  const StaffBinDetailScreen({super.key, required this.binId});

  void _refresh(WidgetRef ref) {
    ref.invalidate(binDetailProvider(binId));
    ref.invalidate(binCapturesProvider(binId));
    ref.invalidate(binForecastProvider(binId));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(binDetailProvider(binId));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: async.when(
        loading: () => const _DetailSkeleton(),
        error: (e, _) => SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.topLeft,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: GlassIconButton(
                    icon: Icons.arrow_back_rounded,
                    onTap: () => _goBack(context),
                  ),
                ),
              ),
              Expanded(
                child: ErrorState(
                  message: friendlyError(e),
                  onRetry: () => _refresh(ref),
                ),
              ),
            ],
          ),
        ),
        data: (data) => RefreshIndicator(
          color: AppColors.brand,
          backgroundColor: AppColors.surface,
          edgeOffset: 120,
          onRefresh: () async {
            _refresh(ref);
            await ref.read(binDetailProvider(binId).future).catchError(
                  (_) => data,
                );
          },
          child: _DetailBody(data: data, onRefresh: () => _refresh(ref)),
        ),
      ),
    );
  }
}

void _goBack(BuildContext context) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go('/staff/bins');
  }
}

class _DetailBody extends ConsumerWidget {
  final BinLatest data;
  final VoidCallback onRefresh;
  const _DetailBody({required this.data, required this.onRefresh});

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

  void _copyCoords(BuildContext context, Bin device) {
    Clipboard.setData(ClipboardData(
      text:
          '${device.latitude.toStringAsFixed(6)}, ${device.longitude.toStringAsFixed(6)}',
    ));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Coordinates copied')),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final device = data.device;
    final extras = data.extras;
    final fill = data.fillLevel ?? device.latestFillLevel;
    final pct = extras?.fillPercentage ?? device.latestFillPercentage;
    final color = fillColor(fill);
    final frac = fillFraction(fill, pct);
    final capturedAt = data.capturedAt ?? device.latestCapturedAt;
    final imageUrl = data.imageUrl ?? device.latestImageUrl;
    final risk = extras?.riskLevel ?? device.latestRiskLevel;

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: [
        SliverAppBar(
          expandedHeight: 320,
          pinned: true,
          stretch: true,
          backgroundColor: AppColors.background,
          leading: Padding(
            padding: const EdgeInsets.all(6),
            child: GlassIconButton(
              icon: Icons.arrow_back_rounded,
              size: 42,
              onTap: () => _goBack(context),
            ),
          ),
          actions: [
            GlassIconButton(
              icon: Icons.refresh_rounded,
              size: 42,
              tooltip: 'Refresh',
              onTap: onRefresh,
            ),
            const SizedBox(width: 8),
            PopupMenuButton<String>(
              color: AppColors.surfaceElevated,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              onSelected: (v) {
                if (v == 'copy') _copyCoords(context, device);
                if (v == 'maps') _openGoogleMaps(context, device);
                if (v == 'route') context.go('/staff/routes');
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'copy', child: Text('Copy coordinates')),
                PopupMenuItem(value: 'maps', child: Text('Open in Google Maps')),
                PopupMenuItem(value: 'route', child: Text("Today's route")),
              ],
              child: const GlassIconButton(icon: Icons.more_horiz_rounded, size: 42),
            ),
            const SizedBox(width: 12),
          ],
          flexibleSpace: FlexibleSpaceBar(
            stretchModes: const [
              StretchMode.zoomBackground,
              StretchMode.fadeTitle,
            ],
            background: Stack(
              fit: StackFit.expand,
              children: [
                imageUrl != null
                    ? GestureDetector(
                        onTap: () => _openPhoto(context, imageUrl, capturedAt),
                        child: AppNetworkImage(
                          url: imageUrl,
                          fallback: const CityScene(height: 320, showBins: false),
                        ),
                      )
                    : const CityScene(height: 320, showBins: false),
                const IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(gradient: AppGradients.photoScrim),
                  ),
                ),
                Positioned(
                  left: 20,
                  right: 20,
                  bottom: 18,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          StatusPill(
                            label: fillLabel(fill),
                            color: color,
                            icon: fillIcon(fill),
                            solid: true,
                          ),
                          if (risk != null) RiskBadge(riskLevel: risk),
                          GlassChip(
                            icon: Icons.schedule_rounded,
                            label: timeAgo(capturedAt),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        binCode(device.id),
                        style: AppText.display.copyWith(fontSize: 30),
                      ),
                      Text(
                        device.address ?? device.location ?? device.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body.copyWith(color: Colors.white70),
                      ),
                    ],
                  ).animate().fadeIn(duration: Motion.slow).slideY(begin: 0.2),
                ),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
          sliver: SliverList.list(
            children: [
              _FillCard(
                fraction: frac,
                color: color,
                fill: fill,
                pct: pct,
                capturedAt: capturedAt,
                model: data.modelName,
              ).entrance(index: 0),
              const SizedBox(height: 22),
              const SectionTitle('AI insights'),
              const SizedBox(height: 12),
              _InsightsGrid(extras: extras, risk: risk).entrance(index: 1),
              const SizedBox(height: 22),
              _TrendCard(binId: device.id).entrance(index: 2),
              const SizedBox(height: 16),
              _BinForecastCard(binId: device.id).entrance(index: 3),
              const SizedBox(height: 22),
              _CaptureGallery(binId: device.id),
              const SizedBox(height: 22),
              _LocationCard(
                device: device,
                color: color,
                onCopy: () => _copyCoords(context, device),
              ).entrance(index: 4),
              const SizedBox(height: 24),
              GlowPrimaryButton(
                label: 'Start navigation',
                icon: Icons.navigation_rounded,
                onPressed: () => _startInAppNavigation(context, device),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _openGoogleMaps(context, device),
                      icon: const Icon(Icons.map_rounded, size: 18),
                      label: const Text('Google Maps'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => context.go('/staff/routes'),
                      icon: const Icon(Icons.route_rounded, size: 18),
                      label: const Text('Route'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

void _openPhoto(BuildContext context, String url, String? capturedAt) {
  Navigator.of(context).push(
    PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black87,
      pageBuilder: (_, __, ___) => _PhotoViewer(url: url, capturedAt: capturedAt),
      transitionsBuilder: (_, anim, __, child) =>
          FadeTransition(opacity: anim, child: child),
    ),
  );
}

class _PhotoViewer extends StatelessWidget {
  final String url;
  final String? capturedAt;
  const _PhotoViewer({required this.url, this.capturedAt});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: InteractiveViewer(
                maxScale: 5,
                child: Center(
                  child: AppNetworkImage(url: url, fit: BoxFit.contain),
                ),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: GlassIconButton(
                icon: Icons.close_rounded,
                onTap: () => Navigator.of(context).pop(),
              ),
            ),
            if (capturedAt != null)
              Positioned(
                bottom: 20,
                left: 0,
                right: 0,
                child: Center(
                  child: GlassChip(
                    icon: Icons.photo_camera_rounded,
                    label: 'Captured ${formatTs(capturedAt)}',
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _FillCard extends StatelessWidget {
  final double fraction;
  final Color color;
  final String? fill;
  final double? pct;
  final String? capturedAt;
  final String? model;

  const _FillCard({
    required this.fraction,
    required this.color,
    required this.fill,
    required this.pct,
    required this.capturedAt,
    required this.model,
  });

  @override
  Widget build(BuildContext context) {
    final hasData = fill != null || pct != null;
    return StaffCard(
      tint: color.withValues(alpha: 0.08),
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          LiquidBinGauge(
            fraction: fraction,
            color: color,
            width: 118,
            height: 150,
            center: hasData
                ? AnimatedCount(
                    value: fraction * 100,
                    suffix: '%',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      shadows: [Shadow(color: Colors.black54, blurRadius: 8)],
                    ),
                  )
                : const Text('—', style: AppText.h1),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('FILL LEVEL', style: AppText.overline),
                const SizedBox(height: 4),
                Text(
                  fillLabel(fill),
                  style: AppText.h1.copyWith(color: color, fontSize: 22),
                ),
                const SizedBox(height: 4),
                Text(
                  !hasData
                      ? 'Waiting for the first capture from this bin.'
                      : fraction >= 0.9
                          ? 'Overflowing — schedule a pickup now.'
                          : fraction >= 0.45
                              ? 'Filling up — include in the next route.'
                              : 'Plenty of space left.',
                  style: AppText.body.copyWith(fontSize: 12),
                ),
                const SizedBox(height: 14),
                _MetaRow(
                  icon: Icons.schedule_rounded,
                  text: capturedAt == null ? 'No captures yet' : formatTs(capturedAt),
                ),
                if (model != null) ...[
                  const SizedBox(height: 6),
                  _MetaRow(
                    icon: Icons.memory_rounded,
                    text: model == 'all'
                        ? 'Analysed by all AI models'
                        : 'Model: ${titleCase(model!)}',
                  ),
                ],
                if (pct == null && hasData) ...[
                  const SizedBox(height: 6),
                  const _MetaRow(
                    icon: Icons.info_outline_rounded,
                    text: 'Estimated from fill tier',
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

class _MetaRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _MetaRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.textMuted),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.caption,
          ),
        ),
      ],
    );
  }
}

class _InsightsGrid extends StatelessWidget {
  final BinLatestExtras? extras;
  final String? risk;
  const _InsightsGrid({required this.extras, required this.risk});

  @override
  Widget build(BuildContext context) {
    final e = extras;
    final littering = e?.litteringEventDetected == true;
    final tiles = [
      _Insight(
        icon: Icons.recycling_rounded,
        label: 'Waste type',
        value: e?.wasteLabel != null ? titleCase(e!.wasteLabel!) : '—',
        note: e?.wasteConfidence != null
            ? '${(e!.wasteConfidence! * (e.wasteConfidence! <= 1 ? 100 : 1)).round()}% confidence'
            : 'Waste classifier',
        color: AppColors.brandGlow,
      ),
      _Insight(
        icon: Icons.pets_rounded,
        label: 'Animals',
        value: e?.animalCount == null
            ? '—'
            : e!.animalCount == 0
                ? 'None'
                : '${e.animalCount} seen',
        note: (e?.animalCount ?? 0) > 0 ? 'Animal activity nearby' : 'No activity',
        color: (e?.animalCount ?? 0) > 0 ? AppColors.riskMedium : AppColors.accentTeal,
      ),
      _Insight(
        icon: Icons.thermostat_rounded,
        label: 'Temperature',
        value: e?.tempC != null ? '${e!.tempC!.toStringAsFixed(1)}°C' : '—',
        note: 'At capture time',
        color: AppColors.accentPink,
      ),
      _Insight(
        icon: Icons.water_drop_rounded,
        label: 'Humidity',
        value: e?.humidityPct != null ? '${e!.humidityPct!.round()}%' : '—',
        note: 'At capture time',
        color: AppColors.accentBlue,
      ),
      _Insight(
        icon: Icons.health_and_safety_rounded,
        label: 'Hygiene risk',
        value: risk?.toUpperCase() ?? '—',
        note: e?.riskCase != null ? titleCase(e!.riskCase!) : 'Risk engine',
        color: riskColor(risk),
      ),
      _Insight(
        icon: Icons.report_rounded,
        label: 'Littering',
        value: littering ? 'Detected' : 'None',
        note: littering
            ? '${e?.litteringEventCount ?? 1} event(s)${e?.litteringMaxConfidence != null ? ' · ${(e!.litteringMaxConfidence! * 100).round()}%' : ''}'
            : 'No illegal dumping',
        color: littering ? AppColors.riskHigh : AppColors.riskLow,
      ),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.45,
      children: [
        for (var i = 0; i < tiles.length; i++)
          _InsightTile(insight: tiles[i])
              .animate(delay: Motion.stagger(i, stepMs: 60))
              .fadeIn(duration: Motion.medium)
              .scaleXY(begin: 0.92, end: 1, curve: Curves.easeOutBack),
      ],
    );
  }
}

class _Insight {
  final IconData icon;
  final String label;
  final String value;
  final String note;
  final Color color;
  const _Insight({
    required this.icon,
    required this.label,
    required this.value,
    required this.note,
    required this.color,
  });
}

class _InsightTile extends StatelessWidget {
  final _Insight insight;
  const _InsightTile({required this.insight});

  @override
  Widget build(BuildContext context) {
    return StaffCard(
      padding: const EdgeInsets.all(14),
      radius: 20,
      tint: insight.color.withValues(alpha: 0.06),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              IconTile(icon: insight.icon, color: insight.color, size: 32),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  insight.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.caption.copyWith(fontSize: 12),
                ),
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                insight.value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: insight.value == '—'
                      ? AppColors.textMuted
                      : AppColors.textPrimary,
                ),
              ),
              Text(
                insight.note,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.caption.copyWith(fontSize: 10),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TrendCard extends ConsumerWidget {
  final int binId;
  const _TrendCard({required this.binId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(binCapturesProvider(binId));
    return StaffCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const IconTile(
                icon: Icons.show_chart_rounded,
                color: AppColors.brandGlow,
                size: 40,
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Fill trend', style: AppText.title),
                    Text('Recent captures', style: AppText.caption),
                  ],
                ),
              ),
              if (async.valueOrNull != null)
                StatusPill(
                  label: '${async.valueOrNull!.length} captures',
                  color: AppColors.textSecondary,
                ),
            ],
          ),
          const SizedBox(height: 18),
          async.when(
            loading: () => const SkeletonBox(height: 130),
            error: (e, _) => Text(friendlyError(e), style: AppText.caption),
            data: (captures) => FillHistoryChart(captures: captures),
          ),
        ],
      ),
    );
  }
}

class _BinForecastCard extends ConsumerWidget {
  final int binId;
  const _BinForecastCard({required this.binId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(binForecastProvider(binId));
    return StaffCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const IconTile(
                icon: Icons.insights_rounded,
                color: AppColors.accentTeal,
                size: 40,
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Risk forecast', style: AppText.title),
                    Text('Next 24 hours for this bin', style: AppText.caption),
                  ],
                ),
              ),
              if (async.valueOrNull?.maxLevel != null)
                RiskBadge(riskLevel: async.valueOrNull!.maxLevel),
            ],
          ),
          const SizedBox(height: 16),
          async.when(
            loading: () => const SkeletonBox(height: 130),
            error: (e, _) => Text(friendlyError(e), style: AppText.caption),
            data: (f) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RiskForecastChart(slots: f.slots, height: 90),
                if (f.recommendation != null) ...[
                  const SizedBox(height: 8),
                  Text(f.recommendation!, style: AppText.body.copyWith(fontSize: 12)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CaptureGallery extends ConsumerWidget {
  final int binId;
  const _CaptureGallery({required this.binId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final captures = (ref.watch(binCapturesProvider(binId)).valueOrNull ?? [])
        .where((c) => c.hasImage)
        .toList();
    if (captures.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle('Photo history · ${captures.length}'),
        const SizedBox(height: 12),
        SizedBox(
          height: 168,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            clipBehavior: Clip.none,
            itemCount: captures.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (_, i) {
              final c = captures[i];
              final url = ApiClient.instance.captureImageUrl(c.id);
              final color = fillColor(c.fillLevel);
              return Pressable(
                onTap: () => _openPhoto(context, url, c.capturedAt),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: SizedBox(
                    width: 128,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        AppNetworkImage(url: url),
                        const DecoratedBox(
                          decoration:
                              BoxDecoration(gradient: AppGradients.photoScrim),
                        ),
                        Positioned(
                          top: 8,
                          left: 8,
                          child: StatusPill(
                            label: c.fillLevel == null
                                ? 'No data'
                                : '${fillPercentOf(c.fillLevel, c.fillPercentage)}%',
                            color: color,
                            solid: true,
                          ),
                        ),
                        Positioned(
                          left: 10,
                          right: 10,
                          bottom: 10,
                          child: Text(
                            timeAgo(c.capturedAt),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ).animate(delay: Motion.stagger(i)).fadeIn().slideX(begin: 0.15);
            },
          ),
        ),
      ],
    );
  }
}

class _LocationCard extends StatelessWidget {
  final Bin device;
  final Color color;
  final VoidCallback onCopy;

  const _LocationCard({
    required this.device,
    required this.color,
    required this.onCopy,
  });

  @override
  Widget build(BuildContext context) {
    final point = LatLng(device.latitude, device.longitude);
    return StaffCard(
      padding: const EdgeInsets.all(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(
              height: 160,
              child: FlutterMap(
                options: MapOptions(
                  initialCenter: point,
                  initialZoom: 16,
                  interactionOptions:
                      const InteractionOptions(flags: InteractiveFlag.none),
                ),
                children: [
                  visionWasteTileLayer(dark: true),
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: point,
                        width: 52,
                        height: 52,
                        child: Center(
                          child: BinFillMarker(
                            fillLevel: device.latestFillLevel,
                            fillPercentage: device.latestFillPercentage,
                            selected: true,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 12, 4, 6),
            child: Row(
              children: [
                const IconTile(
                  icon: Icons.place_rounded,
                  color: AppColors.accentBlue,
                  size: 38,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        device.address ?? device.location ?? device.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.title.copyWith(fontSize: 14),
                      ),
                      Text(
                        '${device.latitude.toStringAsFixed(5)}, ${device.longitude.toStringAsFixed(5)}',
                        style: AppText.caption,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Copy coordinates',
                  onPressed: onCopy,
                  icon: const Icon(Icons.copy_rounded,
                      size: 18, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      children: const [
        SkeletonBox(height: 320, radius: 0),
        Padding(
          padding: EdgeInsets.all(20),
          child: Column(
            children: [
              SkeletonBox(height: 190, radius: 22),
              SizedBox(height: 20),
              Row(
                children: [
                  Expanded(child: SkeletonBox(height: 100, radius: 20)),
                  SizedBox(width: 12),
                  Expanded(child: SkeletonBox(height: 100, radius: 20)),
                ],
              ),
              SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: SkeletonBox(height: 100, radius: 20)),
                  SizedBox(width: 12),
                  Expanded(child: SkeletonBox(height: 100, radius: 20)),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
