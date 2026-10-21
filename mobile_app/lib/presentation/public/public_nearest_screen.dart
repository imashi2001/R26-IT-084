import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../config/map_layers.dart';
import '../../data/providers.dart';
import '../../domain/models.dart';
import '../../domain/navigation_args.dart';
import '../../services/google_maps_launcher.dart';
import '../../theme/app_theme.dart';
import '../shared/motion.dart';
import '../shared/widgets.dart';

class PublicNearestScreen extends ConsumerStatefulWidget {
  const PublicNearestScreen({super.key});

  @override
  ConsumerState<PublicNearestScreen> createState() =>
      _PublicNearestScreenState();
}

class _PublicNearestScreenState extends ConsumerState<PublicNearestScreen> {
  final _mapController = MapController();
  LatLng? _userLatLng;
  bool _locating = false;
  bool _mapReady = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _fetchLocation());
  }

  void _safeMove(LatLng target, double zoom) {
    if (!_mapReady || !mounted) return;
    try {
      _mapController.move(target, zoom);
    } catch (_) {}
  }

  Future<void> _fetchLocation() async {
    setState(() => _locating = true);
    try {
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever ||
          perm == LocationPermission.denied) {
        _showSnack('Location permission denied. Enable it in Settings.');
        return;
      }

      final last = await Geolocator.getLastKnownPosition();
      if (last != null && mounted) {
        final ll = LatLng(last.latitude, last.longitude);
        setState(() => _userLatLng = ll);
        _safeMove(ll, 14);
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      final ll = LatLng(pos.latitude, pos.longitude);
      if (!mounted) return;
      setState(() => _userLatLng = ll);
      _safeMove(ll, 15);

      await ref.read(nearestProvider.notifier).fetch(pos.latitude, pos.longitude);
      final bins = ref.read(nearestProvider).bins;
      if (bins.isNotEmpty && mounted) {
        await ref.read(nearestProvider.notifier).selectBin(
              bins.first,
              pos.latitude,
              pos.longitude,
            );
        _safeMove(LatLng(bins.first.latitude, bins.first.longitude), 15);
      }
    } catch (e) {
      _showSnack('Could not get location: $e');
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _openGoogleMaps(NearestBinResult bin) async {
    final origin = _userLatLng;
    if (origin == null) return;
    final ok = await openGoogleMapsDriving(
      destLat: bin.latitude,
      destLng: bin.longitude,
      originLat: origin.latitude,
      originLng: origin.longitude,
    );
    if (!ok) _showSnack('Could not open Google Maps');
  }

  void _startInAppNavigation(NearestBinResult bin) {
    if (_userLatLng == null) {
      _showSnack('Waiting for your location…');
      return;
    }
    final route = ref.read(nearestProvider).route;
    context.push(
      '/navigate',
      extra: InAppNavigationArgs(
        title: 'Navigate to bin',
        waypoints: [
          NavWaypoint(
            latitude: bin.latitude,
            longitude: bin.longitude,
            label: bin.name,
            subtitle: formatDistance(bin.distanceMeters),
          ),
        ],
        previewPath: route?.path,
        darkMap: true,
      ),
    );
  }


  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  void _select(NearestBinResult bin) {
    HapticFeedback.selectionClick();
    if (_userLatLng != null) {
      ref.read(nearestProvider.notifier).selectBin(
            bin,
            _userLatLng!.latitude,
            _userLatLng!.longitude,
          );
    }
    _safeMove(LatLng(bin.latitude, bin.longitude), 16);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(nearestProvider);
    final route = state.route;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _userLatLng ?? const LatLng(6.9271, 79.8612),
              initialZoom: 13,
              onMapReady: () {
                _mapReady = true;
                if (_userLatLng != null) _safeMove(_userLatLng!, 14);
              },
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
            ),
            children: [
              visionWasteTileLayer(dark: true),
              if (route?.path.isNotEmpty == true) ...[
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: route!.path.map((c) => LatLng(c[0], c[1])).toList(),
                      strokeWidth: 11,
                      color: AppColors.brandGlow.withValues(alpha: 0.25),
                    ),
                    Polyline(
                      points: route.path.map((c) => LatLng(c[0], c[1])).toList(),
                      strokeWidth: 5,
                      color: route.approximate
                          ? AppColors.riskMedium
                          : AppColors.brandGlow,
                      isDotted: route.approximate,
                    ),
                  ],
                ),
              ],
              MarkerLayer(
                markers: [
                  if (_userLatLng != null)
                    Marker(
                      point: _userLatLng!,
                      width: 60,
                      height: 60,
                      child: const _UserLocationDot(),
                    ),
                  ...state.bins.map((bin) {
                    final isSelected = state.selected?.id == bin.id;
                    return Marker(
                      point: LatLng(bin.latitude, bin.longitude),
                      width: 54,
                      height: 54,
                      child: GestureDetector(
                        onTap: () => _select(bin),
                        child: Center(
                          child: BinFillMarker(
                            fillLevel: bin.latestFillLevel,
                            fillPercentage: bin.latestFillPercentage,
                            selected: isSelected,
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ),
              RichAttributionWidget(
                alignment: AttributionAlignment.bottomLeft,
                attributions: [
                  TextSourceAttribution(visionWasteMapAttribution),
                ],
              ),
            ],
          ),

          // ── Top overlay ─────────────────────────────────────────────────
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      GlassIconButton(
                        icon: Icons.arrow_back_rounded,
                        tooltip: 'Back',
                        onTap: _back,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Container(
                          height: 46,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceElevated.withValues(alpha: 0.94),
                            borderRadius: BorderRadius.circular(100),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.08),
                            ),
                            boxShadow: AppShadows.soft,
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.near_me_rounded,
                                  color: AppColors.brandGlow, size: 18),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _locating
                                      ? 'Finding your location…'
                                      : state.loading
                                          ? 'Searching nearby bins…'
                                          : state.bins.isEmpty
                                              ? 'Nearest bins'
                                              : '${state.bins.length} bins near you',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.title.copyWith(fontSize: 14),
                                ),
                              ),
                              if (_locating || state.loading)
                                const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      GlassIconButton(
                        icon: Icons.my_location_rounded,
                        tooltip: 'Refresh location',
                        onTap: _fetchLocation,
                      ),
                    ],
                  ).animate().fadeIn(duration: Motion.medium).slideY(begin: -0.4),
                  const SizedBox(height: 10),
                  const MapFillLegend(),
                ],
              ),
            ),
          ),

          // ── Bottom sheet ────────────────────────────────────────────────
          DraggableScrollableSheet(
            initialChildSize: 0.38,
            minChildSize: 0.2,
            maxChildSize: 0.75,
            snap: true,
            snapSizes: const [0.38],
            builder: (context, scrollController) => _BottomPanel(
              scrollController: scrollController,
              state: state,
              onSelectBin: _select,
              onOpenMaps: _openGoogleMaps,
              onStartNavigation: _startInAppNavigation,
              onRefresh: _fetchLocation,
              userLatLng: _userLatLng,
            ),
          ),
        ],
      ),
    );
  }
}

class _UserLocationDot extends StatelessWidget {
  const _UserLocationDot();

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.accentBlue.withValues(alpha: 0.25),
          ),
        )
            .animate(onPlay: (c) => c.repeat())
            .scaleXY(begin: 0.3, end: 1, duration: 1800.ms)
            .fadeOut(duration: 1800.ms),
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            color: AppColors.accentBlue,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 3),
            boxShadow: AppShadows.glow(AppColors.accentBlue),
          ),
        ),
      ],
    );
  }
}

class _BottomPanel extends StatelessWidget {
  final ScrollController scrollController;
  final NearestState state;
  final void Function(NearestBinResult) onSelectBin;
  final void Function(NearestBinResult) onOpenMaps;
  final void Function(NearestBinResult) onStartNavigation;
  final VoidCallback onRefresh;
  final LatLng? userLatLng;

  const _BottomPanel({
    required this.scrollController,
    required this.state,
    required this.onSelectBin,
    required this.onOpenMaps,
    required this.onStartNavigation,
    required this.onRefresh,
    required this.userLatLng,
  });

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (state.error != null) {
      body = ErrorState(message: state.error!, onRetry: onRefresh);
    } else if (!state.loading && state.bins.isEmpty && userLatLng != null) {
      body = Column(
        children: [
          const EmptyHint(
            icon: Icons.search_off_rounded,
            title: 'No bins nearby',
            message: 'We could not find a smart bin close to you.',
          ),
          OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Search again'),
          ),
        ],
      );
    } else if (userLatLng == null && !state.loading) {
      body = Column(
        children: [
          const EmptyHint(
            icon: Icons.location_searching_rounded,
            title: 'Where are you?',
            message: 'Allow location access so we can find the closest bins.',
          ),
          GlowPrimaryButton(
            label: 'Enable location',
            icon: Icons.my_location_rounded,
            onPressed: onRefresh,
            fullWidth: false,
          ),
        ],
      );
    } else if (state.bins.isEmpty) {
      body = const Column(
        children: [
          SkeletonBox(height: 150, radius: 24),
          SizedBox(height: 12),
          SkeletonBox(height: 90, radius: 22),
        ],
      );
    } else {
      final others = state.bins.where((b) => b.id != state.selected?.id).toList();
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (state.selected != null)
            _SelectedBinPanel(
              key: ValueKey(state.selected!.id),
              bin: state.selected!,
              route: state.route,
              onStartNavigation: () => onStartNavigation(state.selected!),
              onOpenMaps: () => onOpenMaps(state.selected!),
            ),
          if (others.isNotEmpty) ...[
            const SizedBox(height: 24),
            const Text('OTHER BINS NEARBY', style: AppText.overline),
            const SizedBox(height: 10),
            for (var i = 0; i < others.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: BinLevelCard(
                  bin: others[i],
                  distanceMeters: others[i].distanceMeters,
                  onTap: () => onSelectBin(others[i]),
                ).entrance(index: i),
              ),
          ],
        ],
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 30,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: ListView(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 32),
        children: [
          Center(
            child: Container(
              width: 42,
              height: 5,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          AnimatedSwitcher(duration: Motion.medium, child: body),
        ],
      ),
    );
  }
}

class _SelectedBinPanel extends StatelessWidget {
  final NearestBinResult bin;
  final RouteResult? route;
  final VoidCallback onStartNavigation;
  final VoidCallback onOpenMaps;

  const _SelectedBinPanel({
    super.key,
    required this.bin,
    required this.route,
    required this.onStartNavigation,
    required this.onOpenMaps,
  });

  @override
  Widget build(BuildContext context) {
    final color = fillColor(bin.latestFillLevel);
    final walkMin = (bin.distanceMeters / 80).ceil().clamp(1, 999);
    final isFull = (bin.latestFillLevel ?? '').toLowerCase() == 'overflow';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Text('CLOSEST TO YOU', style: AppText.overline),
            const Spacer(),
            if (bin.latestCapturedAt != null)
              Text('Updated ${timeAgo(bin.latestCapturedAt)}', style: AppText.caption),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            IconTile(
              icon: fillIcon(bin.latestFillLevel),
              color: color,
              gradient: AppGradients.forFill(bin.latestFillLevel),
              size: 58,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    bin.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.h2,
                  ),
                  if (bin.address != null)
                    Text(
                      bin.address!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.caption.copyWith(fontSize: 12),
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            _InfoBox(
              icon: Icons.near_me_rounded,
              value: bin.formattedDistance,
              label: 'Distance',
              color: AppColors.accentBlue,
            ),
            const SizedBox(width: 10),
            _InfoBox(
              icon: Icons.directions_walk_rounded,
              value: '$walkMin min',
              label: 'Walk',
              color: AppColors.accentTeal,
            ),
            const SizedBox(width: 10),
            _InfoBox(
              icon: Icons.delete_rounded,
              value: bin.latestFillLevel == null
                  ? '—'
                  : '${fillPercentOf(bin.latestFillLevel, bin.latestFillPercentage)}%',
              label: 'Full',
              color: color,
            ),
          ],
        ),
        const SizedBox(height: 16),
        FillMeter(
          fillLevel: bin.latestFillLevel,
          fillPercentage: bin.latestFillPercentage,
        ),
        if (isFull) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.riskHigh.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_rounded, size: 18, color: AppColors.riskHigh),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'This bin is full. Try another bin nearby if you can.',
                    style: TextStyle(fontSize: 12, color: AppColors.textPrimary),
                  ),
                ),
              ],
            ),
          ),
        ],
        if (route != null) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(
                route!.approximate ? Icons.timeline_rounded : Icons.alt_route_rounded,
                size: 14,
                color: route!.approximate ? AppColors.riskMedium : AppColors.brandGlow,
              ),
              const SizedBox(width: 6),
              Text(
                route!.approximate
                    ? 'Straight-line preview — use Maps for roads'
                    : 'Route shown on the map',
                style: AppText.caption,
              ),
            ],
          ),
        ],
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: GlowPrimaryButton(
                label: 'Navigate',
                icon: Icons.navigation_rounded,
                onPressed: onStartNavigation,
              ),
            ),
            const SizedBox(width: 10),
            GlassIconButton(
              icon: Icons.map_rounded,
              tooltip: 'Open in Google Maps',
              size: 56,
              onTap: onOpenMaps,
            ),
          ],
        ),
      ],
    ).animate().fadeIn(duration: Motion.medium).slideY(begin: 0.05);
  }
}

class _InfoBox extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;

  const _InfoBox({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.18)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 6),
            Text(
              value,
              maxLines: 1,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            Text(label, style: AppText.caption),
          ],
        ),
      ),
    );
  }
}
