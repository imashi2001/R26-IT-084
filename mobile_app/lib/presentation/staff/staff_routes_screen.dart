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
  String _period = 'today';
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
    final mapHeight = (MediaQuery.sizeOf(context).height * 0.28).clamp(200.0, 280.0);

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const StaffDrawer(),
      appBar: StaffAppBar(
        title: 'Collection Routes',
        showMenu: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {},
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_loading || _refiningRoute)
            const LinearProgressIndicator(color: AppColors.brand, minHeight: 2),
          Expanded(
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: SegmentedFilterRow(
                      options: const [
                        ('today', 'Today'),
                        ('week', 'Week'),
                        ('month', 'Month'),
                      ],
                      selected: _period,
                      onSelected: (v) => setState(() => _period = v),
                    ),
                  ),
                ),
                if (_error != null)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: StaffCard(
                        tint: AppColors.riskHigh.withValues(alpha: 0.08),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline,
                                color: AppColors.riskHigh, size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _error!,
                                style: const TextStyle(
                                  color: AppColors.riskHigh,
                                  fontSize: 12,
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
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: CentredLoader(label: 'Planning route…'),
                  )
                else ...[
                  if (plan != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                        child: StaffCard(
                          tint: AppColors.brand.withValues(alpha: 0.06),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        const Text(
                                          'Route 01',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 16,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 3,
                                          ),
                                          decoration: BoxDecoration(
                                            color: AppColors.brand
                                                .withValues(alpha: 0.18),
                                            borderRadius:
                                                BorderRadius.circular(100),
                                          ),
                                          child: const Text(
                                            'In Progress',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.brand,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      '${stops.length} stops · ~$durationMin min · ${distanceKm.toStringAsFixed(1)} km',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                    if (plan.excludedEmptyCount > 0)
                                      Text(
                                        '${plan.excludedEmptyCount} empty bins skipped',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.textMuted,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              IconButton(
                                onPressed: _loadRoute,
                                icon: const Icon(Icons.refresh),
                                tooltip: 'Refresh route',
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: SizedBox(
                          height: mapHeight,
                          child: Stack(
                            children: [
                              _MapPreview(
                                polyline: _polyline,
                                stops: stops,
                                userPos: _userPos,
                                onStopTap: (id) =>
                                    context.push('/staff/bins/$id'),
                              ),
                              const Positioned(
                                right: 8,
                                bottom: 8,
                                child: MapFillLegend(compact: true),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                      child: SectionTitle('Route stops'),
                    ),
                  ),
                  if (stops.isEmpty)
                    const SliverToBoxAdapter(
                      child: EmptyHint(
                        message: 'No collection stops right now.',
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      sliver: SliverList.separated(
                        itemCount: stops.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) => RouteStopTile(
                          stop: stops[i],
                          onTap: () =>
                              context.push('/staff/bins/${stops[i].id}'),
                        ),
                      ),
                    ),
                ],
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border(
                  top: BorderSide(
                    color: AppColors.border.withValues(alpha: 0.5),
                  ),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  GlowPrimaryButton(
                    label: 'Start in-app navigation',
                    icon: Icons.navigation_outlined,
                    onPressed:
                        stops.isEmpty || _loading ? null : _startInAppNavigation,
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: stops.isEmpty || _loading ? null : _openGoogleMaps,
                    icon: const Icon(Icons.map_outlined),
                    label: const Text('Open in Google Maps'),
                  ),
                ],
              ),
            ),
          ),
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
    LatLng center = const LatLng(7.8731, 80.7718);
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
                color: AppColors.brand,
                strokeWidth: 4,
              ),
            ],
          ),
        MarkerLayer(
          markers: [
            if (userPos != null)
              Marker(
                point: userPos!,
                width: 32,
                height: 32,
                child: const Icon(Icons.my_location, color: Color(0xFF38BDF8)),
              ),
            ...stops.map(
              (s) => Marker(
                point: LatLng(s.latitude, s.longitude),
                width: 30,
                height: 30,
                child: GestureDetector(
                  onTap: () => onStopTap(s.id),
                  child: CircleAvatar(
                    radius: 14,
                    backgroundColor: fillColor(s.latestFillLevel),
                    child: Text(
                      '${s.order}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
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
