import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/map_layers.dart';
import '../../data/bin_repository.dart';
import '../../data/osrm_service.dart';
import '../../domain/models.dart';
import '../../theme/app_theme.dart';
import '../shared/widgets.dart';
import 'staff_shell.dart';

class StaffRoutesScreen extends ConsumerStatefulWidget {
  const StaffRoutesScreen({super.key});

  @override
  ConsumerState<StaffRoutesScreen> createState() => _StaffRoutesScreenState();
}

class _StaffRoutesScreenState extends ConsumerState<StaffRoutesScreen> {
  CollectionPlan? _plan;
  List<LatLng> _polyline = [];
  bool _loading = false;
  String? _error;
  String _period = 'today';
  LatLng? _userPos;

  @override
  void initState() {
    super.initState();
    _loadRoute();
  }

  Future<void> _loadRoute() async {
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
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      _userPos = LatLng(pos.latitude, pos.longitude);

      final plan = await BinRepository.instance.collectionPlan(
        latitude: pos.latitude,
        longitude: pos.longitude,
      );

      final points = <LatLng>[LatLng(pos.latitude, pos.longitude)];
      final path = <LatLng>[];
      var prevLat = pos.latitude;
      var prevLng = pos.longitude;

      for (final stop in plan.stops) {
        points.add(LatLng(stop.latitude, stop.longitude));
        final leg = await OsrmService.instance.drivingRoute(
          prevLat,
          prevLng,
          stop.latitude,
          stop.longitude,
        );
        for (final p in leg.path) {
          path.add(LatLng(p[0], p[1]));
        }
        prevLat = stop.latitude;
        prevLng = stop.longitude;
      }

      if (mounted) {
        setState(() {
          _plan = plan;
          _polyline = path.isNotEmpty ? path : points;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          _loading = false;
        });
      }
    }
  }

  Future<void> _startNavigation() async {
    final plan = _plan;
    if (plan == null || plan.stops.isEmpty) return;

    final first = plan.stops.first;
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1'
      '&destination=${first.latitude},${first.longitude}'
      '&travelmode=driving',
    );
    await launchUrl(url, mode: LaunchMode.externalApplication);
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
    final plan = _plan;
    final stops = plan?.stops ?? [];
    final distanceKm = plan != null ? _estimateDistanceKm(plan) : 0.0;
    final durationMin = _estimateDurationMin(distanceKm);

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const StaffDrawer(),
      appBar: StaffAppBar(
        title: 'Collection Routes',
        showMenu: true,
        showBack: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {},
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
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
          if (_loading)
            const LinearProgressIndicator(color: AppColors.brand, minHeight: 2),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                _error!,
                style: const TextStyle(color: AppColors.riskHigh, fontSize: 12),
              ),
            ),
          if (plan != null)
            Padding(
              padding: const EdgeInsets.all(16),
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
                                  color: AppColors.brand.withValues(alpha: 0.18),
                                  borderRadius: BorderRadius.circular(100),
                                  border: Border.all(
                                    color: AppColors.brand.withValues(alpha: 0.5),
                                  ),
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
          Expanded(
            flex: 5,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Stack(
                  children: [
                    _MapPreview(
                      polyline: _polyline,
                      stops: stops,
                      userPos: _userPos,
                      onStopTap: (id) => context.push('/staff/bins/$id'),
                    ),
                    const Positioned(
                      right: 10,
                      bottom: 10,
                      child: MapFillLegend(compact: true),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            flex: 4,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: SectionTitle('Route stops'),
                ),
                Expanded(
                  child: stops.isEmpty
                      ? const EmptyHint(message: 'No collection stops right now.')
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: stops.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) => RouteStopTile(
                            stop: stops[i],
                            onTap: () =>
                                context.push('/staff/bins/${stops[i].id}'),
                          ),
                        ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: GlowPrimaryButton(
                    label: 'Start Navigation',
                    icon: Icons.navigation_outlined,
                    onPressed: stops.isEmpty ? null : _startNavigation,
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
      options: MapOptions(initialCenter: center, initialZoom: 13),
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
                width: 36,
                height: 36,
                child: const Icon(Icons.my_location, color: Color(0xFF38BDF8)),
              ),
            ...stops.map(
              (s) => Marker(
                point: LatLng(s.latitude, s.longitude),
                width: 32,
                height: 32,
                child: GestureDetector(
                  onTap: () => onStopTap(s.id),
                  child: CircleAvatar(
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
