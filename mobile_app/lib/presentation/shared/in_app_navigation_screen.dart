import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../config/map_layers.dart';
import '../../data/osrm_service.dart';
import '../../domain/models.dart';
import '../../domain/navigation_args.dart';
import '../../services/google_maps_launcher.dart';
import '../../theme/app_theme.dart';
import '../../utils/route_math.dart';
import '../shared/widgets.dart';

/// Turn-by-turn style in-app navigation on flutter_map (OSRM driving route).
class InAppNavigationScreen extends StatefulWidget {
  final InAppNavigationArgs args;

  const InAppNavigationScreen({super.key, required this.args});

  @override
  State<InAppNavigationScreen> createState() => _InAppNavigationScreenState();
}

class _InAppNavigationScreenState extends State<InAppNavigationScreen> {
  final _mapController = MapController();
  StreamSubscription<Position>? _posSub;

  LatLng? _userPos;
  List<LatLng> _routePoints = [];
  bool _loadingRoute = true;
  bool _followUser = true;
  bool _mapReady = false;
  late int _stopIndex;

  RouteResult? _activeRoute;
  String? _routeError;
  DateTime? _lastFollowMove;

  InAppNavigationArgs get args => widget.args;
  List<NavWaypoint> get waypoints => args.waypoints;
  NavWaypoint get target => waypoints[_stopIndex.clamp(0, waypoints.length - 1)];
  bool get isCollection => args.collectionRoute && waypoints.length > 1;
  bool get isLastStop => _stopIndex >= waypoints.length - 1;

  @override
  void initState() {
    super.initState();
    _stopIndex = args.initialStopIndex.clamp(0, waypoints.length - 1);
    if (args.previewPath != null && args.previewPath!.length >= 2) {
      _routePoints = pathFromCoords(args.previewPath!);
    }
    _initNavigation();
  }

  @override
  void dispose() {
    _posSub?.cancel();
    super.dispose();
  }

  Future<void> _initNavigation() async {
    await _ensurePermission();
    await _refreshActiveRoute();
    _startLocationStream();
  }

  Future<void> _ensurePermission() async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied ||
        perm == LocationPermission.deniedForever) {
      setState(() => _routeError = 'Location permission is required for navigation.');
    }
  }

  void _startLocationStream() {
    _posSub?.cancel();
    _posSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 12,
      ),
    ).listen((pos) {
      if (!mounted) return;
      final ll = LatLng(pos.latitude, pos.longitude);
      setState(() => _userPos = ll);
      if (_followUser && _mapReady) {
        final now = DateTime.now();
        if (_lastFollowMove != null &&
            now.difference(_lastFollowMove!).inMilliseconds < 1500) {
          return;
        }
        _lastFollowMove = now;
        try {
          _mapController.move(ll, _mapController.camera.zoom);
        } catch (_) {}
      }
    });

    Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 12),
      ),
    ).then((pos) {
      if (!mounted) return;
      final ll = LatLng(pos.latitude, pos.longitude);
      setState(() => _userPos = ll);
      _fitMap();
    }).catchError((_) {});
  }

  Future<void> _refreshActiveRoute() async {
    setState(() {
      _loadingRoute = true;
      _routeError = null;
    });

    LatLng? from = _userPos;
    if (from == null) {
      try {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 12),
          ),
        );
        from = LatLng(pos.latitude, pos.longitude);
        _userPos = from;
      } catch (_) {}
    }

    if (from == null) {
      if (mounted) {
        setState(() {
          _loadingRoute = false;
          _routeError = 'Waiting for GPS…';
        });
      }
      return;
    }

    final dest = target;
    final result = await OsrmService.instance.drivingRoute(
      from.latitude,
      from.longitude,
      dest.latitude,
      dest.longitude,
    );

    if (!mounted) return;
    setState(() {
      _activeRoute = result;
      _routePoints = pathFromCoords(result.path);
      _loadingRoute = false;
    });
    _fitMap();
  }

  void _fitMap() {
    if (!_mapReady) return;
    final points = <LatLng>[..._routePoints];
    if (_userPos != null) points.add(_userPos!);
    points.add(LatLng(target.latitude, target.longitude));
    if (points.isEmpty) return;

    if (points.length == 1) {
      _mapController.move(points.first, 15);
      return;
    }

    var minLat = points.first.latitude;
    var maxLat = points.first.latitude;
    var minLng = points.first.longitude;
    var maxLng = points.first.longitude;
    for (final p in points) {
      minLat = mathMin(minLat, p.latitude);
      maxLat = mathMax(maxLat, p.latitude);
      minLng = mathMin(minLng, p.longitude);
      maxLng = mathMax(maxLng, p.longitude);
    }
    final bounds = LatLngBounds(
      LatLng(minLat, minLng),
      LatLng(maxLat, maxLng),
    );
    try {
      _mapController.fitCamera(
        CameraFit.bounds(bounds: bounds, padding: const EdgeInsets.all(48)),
      );
    } catch (_) {
      _mapController.move(
        LatLng((minLat + maxLat) / 2, (minLng + maxLng) / 2),
        14,
      );
    }
  }

  double _remainingMeters() {
    if (_userPos == null) {
      return _activeRoute?.distanceMeters ??
          haversineMeters(
            LatLng(target.latitude, target.longitude),
            LatLng(target.latitude, target.longitude),
          );
    }
    if (_routePoints.length >= 2) {
      return remainingRouteMeters(_userPos!, _routePoints);
    }
    return haversineMeters(
      _userPos!,
      LatLng(target.latitude, target.longitude),
    );
  }

  int _etaSeconds() {
    final osrm = _activeRoute?.durationSeconds;
    if (osrm != null && osrm > 0 && _userPos == null) {
      return osrm.ceil();
    }
    return estimateDurationSeconds(_remainingMeters());
  }

  bool get _arrived {
    if (_userPos == null) return false;
    return haversineMeters(
          _userPos!,
          LatLng(target.latitude, target.longitude),
        ) <
        45;
  }

  Future<void> _openGoogleMaps() async {
    final ok = await openGoogleMapsToWaypoint(
      target,
      origin: _userPos,
      allWaypoints: isCollection ? waypoints : null,
      activeIndex: _stopIndex,
    );
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open Google Maps')),
      );
    }
  }

  Future<void> _nextStop() async {
    if (!isCollection || isLastStop) {
      if (mounted) context.pop();
      return;
    }
    setState(() => _stopIndex += 1);
    await _refreshActiveRoute();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Navigating to ${target.label}')),
      );
    }
  }

  double mathMin(double a, double b) => a < b ? a : b;
  double mathMax(double a, double b) => a > b ? a : b;

  @override
  Widget build(BuildContext context) {
    final remaining = _remainingMeters();
    final eta = _etaSeconds();
    final dest = LatLng(target.latitude, target.longitude);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: Text(
          args.title,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            tooltip: _followUser ? 'Following GPS' : 'Follow GPS',
            onPressed: () => setState(() => _followUser = !_followUser),
            icon: Icon(
              _followUser ? Icons.gps_fixed : Icons.gps_not_fixed,
              color: _followUser ? AppColors.brand : AppColors.textSecondary,
            ),
          ),
          IconButton(
            tooltip: 'Refresh route',
            onPressed: _loadingRoute ? null : _refreshActiveRoute,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_loadingRoute)
            const LinearProgressIndicator(color: AppColors.brand, minHeight: 2),
          Expanded(
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _userPos ?? dest,
                initialZoom: 14,
                onMapReady: () {
                  _mapReady = true;
                  _fitMap();
                },
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                ),
              ),
              children: [
                visionWasteTileLayer(dark: args.darkMap),
                if (_routePoints.length >= 2)
                  PolylineLayer(
                    polylines: [
                      Polyline(
                        points: _routePoints,
                        strokeWidth: 6,
                        color: (_activeRoute?.approximate ?? false)
                            ? AppColors.riskMedium.withValues(alpha: 0.75)
                            : AppColors.brand.withValues(alpha: 0.9),
                        isDotted: _activeRoute?.approximate ?? false,
                      ),
                    ],
                  ),
                MarkerLayer(
                  markers: [
                    if (_userPos != null)
                      Marker(
                        point: _userPos!,
                        width: 28,
                        height: 28,
                        child: Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFF0EA5E9),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 3),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF0EA5E9)
                                    .withValues(alpha: 0.5),
                                blurRadius: 10,
                              ),
                            ],
                          ),
                        ),
                      ),
                    Marker(
                      point: dest,
                      width: 40,
                      height: 40,
                      child: const Icon(
                        Icons.location_on,
                        color: AppColors.fillOverflow,
                        size: 40,
                      ),
                    ),
                    if (isCollection)
                      ...waypoints.asMap().entries.map((e) {
                        if (e.key == _stopIndex) return null;
                        final w = e.value;
                        return Marker(
                          point: LatLng(w.latitude, w.longitude),
                          width: 28,
                          height: 28,
                          child: CircleAvatar(
                            backgroundColor: AppColors.card,
                            child: Text(
                              '${w.order ?? e.key + 1}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                        );
                      }).whereType<Marker>(),
                  ],
                ),
                RichAttributionWidget(
                  attributions: [
                    TextSourceAttribution(visionWasteMapAttribution),
                  ],
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: StaffCard(
                tint: AppColors.brand.withValues(alpha: 0.06),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.brand.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.navigation,
                            color: AppColors.brand,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                target.label,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 16,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              if (target.subtitle != null)
                                Text(
                                  target.subtitle!,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _StatChip(
                          icon: Icons.straighten,
                          label: formatDistance(remaining),
                        ),
                        const SizedBox(width: 8),
                        _StatChip(
                          icon: Icons.schedule,
                          label: formatDurationShort(eta),
                        ),
                        if (isCollection) ...[
                          const SizedBox(width: 8),
                          _StatChip(
                            icon: Icons.pin_drop_outlined,
                            label: '${_stopIndex + 1}/${waypoints.length}',
                          ),
                        ],
                      ],
                    ),
                    if (_routeError != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _routeError!,
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.riskMedium,
                        ),
                      ),
                    ],
                    if (_arrived) ...[
                      const SizedBox(height: 8),
                      Text(
                        isCollection && !isLastStop
                            ? 'You are near this stop — continue to next bin?'
                            : 'You have arrived at the destination',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.brand,
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),
                    if (isCollection && !isLastStop)
                      GlowPrimaryButton(
                        label: _arrived ? 'Next stop' : 'Next stop (manual)',
                        icon: Icons.skip_next,
                        onPressed: _nextStop,
                      )
                    else if (isCollection && isLastStop && _arrived)
                      GlowPrimaryButton(
                        label: 'Finish route',
                        icon: Icons.check_circle_outline,
                        onPressed: () => context.pop(),
                      ),
                    if (isCollection && !isLastStop) const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _openGoogleMaps,
                      icon: const Icon(Icons.map_outlined, size: 18),
                      label: const Text('Open in Google Maps'),
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

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _StatChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: AppColors.textSecondary),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
