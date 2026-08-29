import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/providers.dart';
import '../../domain/models.dart';
import '../../theme/app_theme.dart';
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
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1'
      '&origin=${origin.latitude},${origin.longitude}'
      '&destination=${bin.latitude},${bin.longitude}'
      '&travelmode=driving',
    );
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      _showSnack('Could not open Google Maps');
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(nearestProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _userLatLng ?? const LatLng(7.8731, 80.7718),
              initialZoom: 13,
              onMapReady: () {
                _mapReady = true;
                if (_userLatLng != null) _safeMove(_userLatLng!, 14);
              },
            ),
            children: [
              TileLayer(
                urlTemplate:
                    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                subdomains: const ['a', 'b', 'c', 'd'],
                userAgentPackageName: 'com.visionwaste.app',
              ),
              if (state.route?.path.isNotEmpty == true)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: state.route!.path
                          .map((c) => LatLng(c[0], c[1]))
                          .toList(),
                      strokeWidth: 5,
                      color: state.route!.approximate
                          ? AppColors.riskMedium.withValues(alpha: 0.7)
                          : AppColors.brand.withValues(alpha: 0.88),
                      isDotted: state.route!.approximate,
                    ),
                  ],
                ),
              MarkerLayer(
                markers: [
                  if (_userLatLng != null)
                    Marker(
                      point: _userLatLng!,
                      width: 22,
                      height: 22,
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF0EA5E9),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                        ),
                      ),
                    ),
                  ...state.bins.map((bin) {
                    final isSelected = state.selected?.id == bin.id;
                    return Marker(
                      point: LatLng(bin.latitude, bin.longitude),
                      width: isSelected ? 52 : 44,
                      height: isSelected ? 52 : 44,
                      child: GestureDetector(
                        onTap: () {
                          if (_userLatLng != null) {
                            ref.read(nearestProvider.notifier).selectBin(
                                  bin,
                                  _userLatLng!.latitude,
                                  _userLatLng!.longitude,
                                );
                          }
                          _safeMove(
                              LatLng(bin.latitude, bin.longitude), 16);
                        },
                        child: BinFillMarker(
                          fillLevel: bin.latestFillLevel,
                          fillPercentage: bin.latestFillPercentage,
                          selected: isSelected,
                        ),
                      ),
                    );
                  }),
                ],
              ),
              const RichAttributionWidget(attributions: [
                TextSourceAttribution('© OpenStreetMap contributors'),
              ]),
            ],
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: AppColors.surface.withValues(alpha: 0.96),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.delete_outline,
                                  color: AppColors.brand, size: 20),
                              const SizedBox(width: 8),
                              const Expanded(
                                child: Text(
                                  'Nearest bins',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                    color: AppColors.textPrimary,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (_locating || state.loading)
                                const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: AppColors.brand),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      _MapButton(
                        icon: Icons.my_location,
                        onTap: _fetchLocation,
                        tooltip: 'Refresh location',
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const MapFillLegend(),
                ],
              ),
            ),
          ),
          DraggableScrollableSheet(
            initialChildSize: 0.34,
            minChildSize: 0.22,
            maxChildSize: 0.58,
            builder: (context, scrollController) {
              return _BottomPanel(
                scrollController: scrollController,
                state: state,
                onSelectBin: (bin) {
                  if (_userLatLng != null) {
                    ref.read(nearestProvider.notifier).selectBin(
                        bin, _userLatLng!.latitude, _userLatLng!.longitude);
                  }
                  _safeMove(LatLng(bin.latitude, bin.longitude), 16);
                },
                onOpenMaps: _openGoogleMaps,
                onRefresh: _fetchLocation,
                userLatLng: _userLatLng,
              );
            },
          ),
        ],
      ),
    );
  }
}

class _MapButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;
  const _MapButton(
      {required this.icon, required this.onTap, required this.tooltip});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: AppColors.surface.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Icon(icon, color: AppColors.textPrimary, size: 20),
          ),
        ),
      ),
    );
  }
}

class _BottomPanel extends StatelessWidget {
  final ScrollController scrollController;
  final NearestState state;
  final void Function(NearestBinResult) onSelectBin;
  final void Function(NearestBinResult) onOpenMaps;
  final VoidCallback onRefresh;
  final LatLng? userLatLng;

  const _BottomPanel({
    required this.scrollController,
    required this.state,
    required this.onSelectBin,
    required this.onOpenMaps,
    required this.onRefresh,
    required this.userLatLng,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.98),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: AppColors.border),
      ),
      child: ListView(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          if (state.error != null)
            ErrorState(message: state.error!, onRetry: onRefresh)
          else if (!state.loading && state.bins.isEmpty && userLatLng != null)
            Column(
              children: [
                const Icon(Icons.search_off,
                    size: 40, color: AppColors.textSecondary),
                const SizedBox(height: 8),
                const Text('No bins found nearby',
                    style: TextStyle(
                        color: AppColors.textSecondary, fontSize: 14)),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: onRefresh,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            )
          else if (userLatLng == null && !state.loading)
            Column(
              children: [
                const Icon(Icons.location_searching,
                    size: 40, color: AppColors.brand),
                const SizedBox(height: 8),
                const Text('Allow location to find bins',
                    style: TextStyle(
                        color: AppColors.textSecondary, fontSize: 14)),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: onRefresh,
                  icon: const Icon(Icons.my_location),
                  label: const Text('Enable Location'),
                ),
              ],
            )
          else ...[
            if (state.selected != null)
              _SelectedBinPanel(
                bin: state.selected!,
                route: state.route,
                onOpenMaps: () => onOpenMaps(state.selected!),
              ),
            if (state.bins.length > 1) ...[
              const Divider(height: 24),
              const Text(
                'Other nearby bins',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.4),
              ),
              const SizedBox(height: 8),
              ...state.bins.where((b) => b.id != state.selected?.id).map(
                    (b) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: BinLevelCard(
                        bin: b,
                        distanceMeters: b.distanceMeters,
                        selected: false,
                        onTap: () => onSelectBin(b),
                      ),
                    ),
                  ),
            ],
          ],
        ],
      ),
    );
  }
}

class _SelectedBinPanel extends StatelessWidget {
  final NearestBinResult bin;
  final RouteResult? route;
  final VoidCallback onOpenMaps;

  const _SelectedBinPanel({
    required this.bin,
    required this.route,
    required this.onOpenMaps,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            BinFillMarker(
              fillLevel: bin.latestFillLevel,
              fillPercentage: bin.latestFillPercentage,
              selected: true,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    bin.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                        color: AppColors.textPrimary),
                  ),
                  Text(
                    formatDistance(bin.distanceMeters),
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            if (bin.latestRiskLevel != null)
              RiskBadge(riskLevel: bin.latestRiskLevel),
          ],
        ),
        const SizedBox(height: 14),
        FillMeter(
            fillLevel: bin.latestFillLevel,
            fillPercentage: bin.latestFillPercentage),
        if (route != null) ...[
          const SizedBox(height: 8),
          Text(
            route!.approximate
                ? 'Straight-line preview — open Maps for roads'
                : 'Driving route preview on map',
            style: TextStyle(
                fontSize: 11,
                color: route!.approximate
                    ? AppColors.riskMedium
                    : AppColors.brand),
          ),
        ],
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: onOpenMaps,
            icon: const Icon(Icons.map, size: 18),
            label: const Text('Open in Google Maps'),
          ),
        ),
      ],
    );
  }
}
