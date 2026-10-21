import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../config/map_layers.dart';
import '../../data/bin_repository.dart';
import '../../data/osrm_service.dart';
import '../../domain/models.dart';
import '../../domain/navigation_args.dart';
import '../../services/google_maps_launcher.dart';
import '../../theme/app_theme.dart';
import '../shared/motion.dart';
import '../shared/widgets.dart';
import 'staff_shell.dart';

class StaffRoutesScreen extends ConsumerStatefulWidget {
  const StaffRoutesScreen({super.key});

  @override
  ConsumerState<StaffRoutesScreen> createState() => _StaffRoutesScreenState();
}

class _StaffRoutesScreenState extends ConsumerState<StaffRoutesScreen>
    with AutomaticKeepAliveClientMixin {
  CollectionPlan? _plan;
  List<LatLng> _polyline = [];
  bool _loading = false;
  bool _refiningRoute = false;
  String? _error;
  LatLng? _userPos;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRoute());
  }

  Future<void> _loadRoute() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        throw Exception('Location permission required for route planning.');
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 12),
        ),
      );
      final user = LatLng(pos.latitude, pos.longitude);

      final plan = await BinRepository.instance.collectionPlan(
        latitude: pos.latitude,
        longitude: pos.longitude,
      );

      final quickPoints = <LatLng>[user];
      for (final stop in plan.stops) {
        quickPoints.add(LatLng(stop.latitude, stop.longitude));
      }

      if (!mounted) return;
      setState(() {
        _userPos = user;
        _plan = plan;
        _polyline = quickPoints;
        _loading = false;
        _refiningRoute = plan.stops.isNotEmpty;
      });

      if (plan.stops.isEmpty) {
        setState(() => _refiningRoute = false);
        return;
      }

      final latLng = quickPoints
          .map((p) => [p.latitude, p.longitude])
          .toList();
      final route = await OsrmService.instance.drivingRouteMulti(latLng);

      if (!mounted) return;
      setState(() {
        _polyline = route.path.map((c) => LatLng(c[0], c[1])).toList();
        _refiningRoute = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          _loading = false;
          _refiningRoute = false;
        });
      }
    }
  }

  void _startInAppNavigation() {
    final plan = _plan;
    if (plan == null || plan.stops.isEmpty) return;

    final waypoints = plan.stops
        .map(
          (s) => NavWaypoint(
            latitude: s.latitude,
            longitude: s.longitude,
            label: binCode(s.id),
            subtitle: s.address ?? s.name,
            order: s.order,
          ),
        )
        .toList();

    context.push(
      '/navigate',
      extra: InAppNavigationArgs(
        title: 'Collection route',
        collectionRoute: true,
        waypoints: waypoints,
        previewPath: _polyline.map((p) => [p.latitude, p.longitude]).toList(),
        darkMap: true,
      ),
    );
  }

  Future<void> _openGoogleMaps() async {
    final plan = _plan;
    if (plan == null || plan.stops.isEmpty) return;

    final first = plan.stops.first;
    final ok = await openGoogleMapsDriving(
      destLat: first.latitude,
      destLng: first.longitude,
      originLat: _userPos?.latitude,
      originLng: _userPos?.longitude,
      waypoints: plan.stops
          .map(
            (s) => NavWaypoint(
              latitude: s.latitude,
              longitude: s.longitude,
              label: binCode(s.id),
              order: s.order,
            ),
          )
          .toList(),
    );
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open Google Maps')),
      );
    }
  }

  double _estimateDistanceKm(CollectionPlan plan) {
    if (plan.stops.isEmpty) return 0;
    var total = 0.0;
    var lat = plan.startLat;
    var lng = plan.startLng;
    for (final stop in plan.stops) {
      total += _haversineKm(lat, lng, stop.latitude, stop.longitude);
      lat = stop.latitude;
      lng = stop.longitude;
    }
    return total;
  }

  int _estimateDurationMin(double km) => (km / 35 * 60).ceil().clamp(5, 999);

  double _haversineKm(double lat1, double lng1, double lat2, double lng2) {
    const r = 6371.0;
    final dLat = (lat2 - lat1) * math.pi / 180;
    final dLng = (lng2 - lng1) * math.pi / 180;
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180) *
            math.cos(lat2 * math.pi / 180) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }


  @override
  Widget build(BuildContext context) {
    super.build(context);
    final plan = _plan;
    final stops = plan?.stops ?? [];
    final distanceKm = plan != null ? _estimateDistanceKm(plan) : 0.0;
    final durationMin = _estimateDurationMin(distanceKm);
    final now = DateTime.now();
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.brand,
          backgroundColor: AppColors.surface,
          onRefresh: _loadRoute,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              SliverToBoxAdapter(
                child: StaffHeader(
                  title: "Today's route",
                  subtitle:
                      '${weekdays[now.weekday - 1]}, ${now.day} ${months[now.month - 1]}',
                  showBell: false,
                  actions: [
                    GlassIconButton(
                      icon: Icons.refresh_rounded,
                      tooltip: 'Re-plan route',
                      size: 44,
                      onTap: _loading ? null : _loadRoute,
                    ),
                  ],
                ),
              ),
              if (_loading || _refiningRoute)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(20, 10, 20, 0),
                    child: ClipRRect(
                      borderRadius: BorderRadius.all(Radius.circular(4)),
                      child: LinearProgressIndicator(minHeight: 3),
                    ),
                  ),
                ),
              if (_error != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                    child: StaffCard(
                      tint: AppColors.riskHigh.withValues(alpha: 0.1),
                      child: Row(
                        children: [
                          const IconTile(
                            icon: Icons.location_off_rounded,
                            color: AppColors.riskHigh,
                            size: 40,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _error!,
                              style: AppText.body.copyWith(
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: _loadRoute,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              if (_loading && plan == null)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
                    child: Column(
                      children: [
                        SkeletonBox(height: 190, radius: 28),
                        SizedBox(height: 14),
                        SkeletonBox(height: 240, radius: 24),
                      ],
                    ),
                  ),
                )
              else if (plan != null) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                    child: _SummaryCard(
                      stops: stops.length,
                      distanceKm: distanceKm,
                      durationMin: durationMin,
                      skipped: plan.excludedEmptyCount,
                      onStart: stops.isEmpty || _loading
                          ? null
                          : _startInAppNavigation,
                      onMaps: stops.isEmpty || _loading ? null : _openGoogleMaps,
                    ).entrance(),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                    child: Container(
                      height: 250,
                      decoration: AppColors.glassCard(radius: 24),
                      padding: const EdgeInsets.all(6),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: Stack(
                          children: [
                            _MapPreview(
                              polyline: _polyline,
                              stops: stops,
                              userPos: _userPos,
                              onStopTap: (id) => context.push('/staff/bins/$id'),
                            ),
                            const Positioned(
                              left: 10,
                              top: 10,
                              child: MapFillLegend(compact: true),
                            ),
                          ],
                        ),
                      ),
                    ).entrance(index: 1),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
                    child: SectionTitle(
                      stops.isEmpty ? 'Stops' : 'Stops · ${stops.length}',
                    ),
                  ),
                ),
                if (stops.isEmpty)
                  const SliverToBoxAdapter(
                    child: EmptyHint(
                      icon: Icons.emoji_events_rounded,
                      title: 'No pickups needed',
                      message:
                          'Every bin is below half full. Pull down to re-check later.',
                    ),
                  )
                else
                  SliverPadding(
                    padding:
                        const EdgeInsets.fromLTRB(20, 0, 20, kNavBarClearance),
                    sliver: SliverList.builder(
                      itemCount: stops.length,
                      itemBuilder: (_, i) => RouteStopTile(
                        stop: stops[i],
                        isFirst: i == 0,
                        isLast: i == stops.length - 1,
                        onTap: () => context.push('/staff/bins/${stops[i].id}'),
                      ).entrance(index: i + 2),
                    ),
                  ),
              ],
              if (plan == null && !_loading)
                const SliverToBoxAdapter(
                  child: SizedBox(height: kNavBarClearance),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final int stops;
  final double distanceKm;
  final int durationMin;
  final int skipped;
  final VoidCallback? onStart;
  final VoidCallback? onMaps;

  const _SummaryCard({
    required this.stops,
    required this.distanceKm,
    required this.durationMin,
    required this.skipped,
    required this.onStart,
    required this.onMaps,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: AppGradients.forest,
        border: Border.all(color: AppColors.brand.withValues(alpha: 0.25)),
        boxShadow: AppShadows.glow(AppColors.brandDark, strength: 0.3),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const IconTile(
                icon: Icons.local_shipping_rounded,
                color: Colors.white,
                gradient: AppGradients.brand,
                size: 48,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Optimised collection', style: AppText.h2),
                    Text(
                      stops == 0
                          ? 'Nothing to collect right now'
                          : 'Full bins first, then half full',
                      style: AppText.caption.copyWith(fontSize: 12),
                    ),
                  ],
                ),
              ),
              StatusPill(
                label: stops == 0 ? 'Clear' : 'Ready',
                color: AppColors.brandGlow,
                icon: Icons.check_rounded,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _Stat(value: '$stops', label: 'Stops', icon: Icons.pin_drop_rounded),
              _Stat(
                value: distanceKm.toStringAsFixed(1),
                label: 'km',
                icon: Icons.straighten_rounded,
              ),
              _Stat(
                value: stops == 0 ? '0' : '$durationMin',
                label: 'min',
                icon: Icons.schedule_rounded,
              ),
              _Stat(
                value: '$skipped',
                label: 'Skipped',
                icon: Icons.check_circle_outline_rounded,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: GlowPrimaryButton(
                  label: 'Start navigation',
                  icon: Icons.navigation_rounded,
                  onPressed: onStart,
                ),
              ),
              const SizedBox(width: 10),
              Opacity(
                opacity: onMaps == null ? 0.4 : 1,
                child: GlassIconButton(
                  icon: Icons.map_rounded,
                  tooltip: 'Open in Google Maps',
                  size: 56,
                  onTap: onMaps,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String value;
  final String label;
  final IconData icon;
  const _Stat({required this.value, required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 18, color: AppColors.brandGlow),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          Text(label, style: AppText.caption),
        ],
      ),
    );
  }
}

class _MapPreview extends StatelessWidget {
  final List<LatLng> polyline;
  final List<CollectionStop> stops;
  final LatLng? userPos;
  final ValueChanged<int> onStopTap;

  const _MapPreview({
    required this.polyline,
    required this.stops,
    this.userPos,
    required this.onStopTap,
  });

  @override
  Widget build(BuildContext context) {
    LatLng center = const LatLng(6.9271, 79.8612);
    if (userPos != null) {
      center = userPos!;
    } else if (stops.isNotEmpty) {
      center = LatLng(stops.first.latitude, stops.first.longitude);
    }

    return FlutterMap(
      options: MapOptions(
        initialCenter: center,
        initialZoom: 13,
        interactionOptions: const InteractionOptions(
          flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
        ),
      ),
      children: [
        visionWasteTileLayer(dark: true),
        if (polyline.length >= 2)
          PolylineLayer(
            polylines: [
              Polyline(
                points: polyline,
                color: AppColors.brandGlow.withValues(alpha: 0.35),
                strokeWidth: 10,
              ),
              Polyline(
                points: polyline,
                color: AppColors.brandGlow,
                strokeWidth: 4,
              ),
            ],
          ),
        MarkerLayer(
          markers: [
            if (userPos != null)
              Marker(
                point: userPos!,
                width: 26,
                height: 26,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.accentBlue,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 3),
                    boxShadow: AppShadows.glow(AppColors.accentBlue),
                  ),
                ),
              ),
            ...stops.map(
              (s) => Marker(
                point: LatLng(s.latitude, s.longitude),
                width: 32,
                height: 32,
                child: GestureDetector(
                  onTap: () => onStopTap(s.id),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: AppGradients.forFill(s.latestFillLevel),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '${s.order}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
