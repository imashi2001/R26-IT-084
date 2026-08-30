import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

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

  @override
  Widget build(BuildContext context) {
    final plan = _plan;
    final stops = plan?.stops ?? [];

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
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Text(
                                'Active route',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.brand.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(100),
                                ),
                                child: const Text(
                                  'In progress',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.brand,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${stops.length} stops · ${plan.excludedEmptyCount} empty skipped',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: _loadRoute,
                      icon: const Icon(Icons.refresh),
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
                child: _MapPreview(
                  polyline: _polyline,
                  stops: stops,
                  userPos: _userPos,
                  onStopTap: (id) => context.push('/staff/bins/$id'),
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
                  child: ElevatedButton.icon(
                    onPressed: stops.isEmpty ? null : _startNavigation,
                    icon: const Icon(Icons.navigation_outlined),
                    label: const Text('Start Navigation'),
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
        TileLayer(
          urlTemplate:
              'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          subdomains: const ['a', 'b', 'c', 'd'],
          userAgentPackageName: 'com.visionwaste.app',
        ),
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
