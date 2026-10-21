import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../config/map_layers.dart';
import '../../data/providers.dart';
import '../../domain/models.dart';
import '../../theme/app_theme.dart';
import '../shared/motion.dart';
import '../shared/widgets.dart';
import 'staff_shell.dart';

enum _Sort { fullest, recent, id }

class StaffBinsScreen extends ConsumerStatefulWidget {
  const StaffBinsScreen({super.key});

  @override
  ConsumerState<StaffBinsScreen> createState() => _StaffBinsScreenState();
}

class _StaffBinsScreenState extends ConsumerState<StaffBinsScreen> {
  bool _mapView = false;
  String _filter = 'all';
  String _query = '';
  _Sort _sort = _Sort.fullest;
  final _searchCtl = TextEditingController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final view = GoRouterState.of(context).uri.queryParameters['view'];
    if (view == 'map' && !_mapView) setState(() => _mapView = true);
  }

  @override
  void dispose() {
    _searchCtl.dispose();
    super.dispose();
  }

  List<Bin> _apply(List<Bin> bins) {
    final q = _query.trim().toLowerCase();
    final out = bins.where((b) {
      final tier = (b.latestFillLevel ?? '').toLowerCase();
      if (_filter != 'all' && tier != _filter) return false;
      if (q.isEmpty) return true;
      return binCode(b.id).toLowerCase().contains(q) ||
          b.name.toLowerCase().contains(q) ||
          (b.address ?? '').toLowerCase().contains(q) ||
          (b.location ?? '').toLowerCase().contains(q);
    }).toList();

    switch (_sort) {
      case _Sort.fullest:
        out.sort((a, b) => fillFraction(b.latestFillLevel, b.latestFillPercentage)
            .compareTo(fillFraction(a.latestFillLevel, a.latestFillPercentage)));
      case _Sort.recent:
        out.sort((a, b) =>
            (b.latestCapturedAt ?? '').compareTo(a.latestCapturedAt ?? ''));
      case _Sort.id:
        out.sort((a, b) => a.id.compareTo(b.id));
    }
    return out;
  }

  int _count(List<Bin> bins, String tier) =>
      bins.where((b) => (b.latestFillLevel ?? '').toLowerCase() == tier).length;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(mapBinsProvider);
    final total = async.valueOrNull?.length;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            StaffHeader(
              title: 'Bins',
              subtitle: total == null ? 'Loading…' : '$total smart bins',
              showBell: false,
              actions: [
                _ViewToggle(
                  mapView: _mapView,
                  onChanged: (v) => setState(() => _mapView = v),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Expanded(
              child: async.when(
                loading: () => const SkeletonList(count: 6),
                error: (e, _) => ErrorState(
                  message: friendlyError(e),
                  onRetry: () => ref.invalidate(mapBinsProvider),
                ),
                data: (bins) => AnimatedSwitcher(
                  duration: Motion.medium,
                  child: _mapView
                      ? _BinMap(key: const ValueKey('map'), bins: _apply(bins))
                      : _buildList(bins),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList(List<Bin> bins) {
    final filtered = _apply(bins);
    return RefreshIndicator(
      key: const ValueKey('list'),
      color: AppColors.brand,
      backgroundColor: AppColors.surface,
      onRefresh: () async {
        ref.invalidate(mapBinsProvider);
        await ref.read(mapBinsProvider.future).catchError((_) => <Bin>[]);
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _searchCtl,
                      onChanged: (v) => setState(() => _query = v),
                      style: const TextStyle(color: AppColors.textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Search bin, street or area',
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: _query.isEmpty
                            ? null
                            : IconButton(
                                icon: const Icon(Icons.close_rounded),
                                onPressed: () {
                                  _searchCtl.clear();
                                  setState(() => _query = '');
                                },
                              ),
                        contentPadding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  _SortButton(
                    sort: _sort,
                    onChanged: (s) => setState(() => _sort = s),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 0, 14),
              child: SegmentedFilterRow(
                options: const [
                  ('all', 'All'),
                  ('overflow', 'Full'),
                  ('half', 'Half'),
                  ('empty', 'Empty'),
                ],
                selected: _filter,
                onSelected: (v) => setState(() => _filter = v),
                countById: {
                  'all': bins.length,
                  'overflow': _count(bins, 'overflow'),
                  'half': _count(bins, 'half'),
                  'empty': _count(bins, 'empty'),
                },
                accentById: const {
                  'overflow': AppColors.fillOverflow,
                  'half': AppColors.fillHalf,
                  'empty': AppColors.fillEmpty,
                },
              ),
            ),
          ),
          if (filtered.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: EmptyHint(
                icon: bins.isEmpty
                    ? Icons.delete_outline_rounded
                    : Icons.search_off_rounded,
                title: bins.isEmpty ? 'No bins yet' : 'No matches',
                message: bins.isEmpty
                    ? 'Bins registered on the web dashboard will appear here.'
                    : 'Try another search or filter.',
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, kNavBarClearance),
              sliver: SliverList.separated(
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (_, i) {
                  final b = filtered[i];
                  return PriorityBinTile(
                    key: ValueKey(b.id),
                    bin: b,
                    onTap: () => context.push('/staff/bins/${b.id}'),
                  ).entrance(index: i);
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _ViewToggle extends StatelessWidget {
  final bool mapView;
  final ValueChanged<bool> onChanged;
  const _ViewToggle({required this.mapView, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    Widget seg(bool map, IconData icon) {
      final selected = map == mapView;
      return Pressable(
        onTap: () => onChanged(map),
        child: AnimatedContainer(
          duration: Motion.medium,
          curve: Motion.curve,
          width: 44,
          height: 38,
          decoration: BoxDecoration(
            gradient: selected ? AppGradients.brand : null,
            borderRadius: BorderRadius.circular(100),
          ),
          child: Icon(
            icon,
            size: 20,
            color: selected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          seg(false, Icons.view_agenda_rounded),
          seg(true, Icons.map_rounded),
        ],
      ),
    );
  }
}

class _SortButton extends StatelessWidget {
  final _Sort sort;
  final ValueChanged<_Sort> onChanged;
  const _SortButton({required this.sort, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<_Sort>(
      initialValue: sort,
      onSelected: onChanged,
      color: AppColors.surfaceElevated,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      itemBuilder: (_) => const [
        PopupMenuItem(value: _Sort.fullest, child: Text('Most full first')),
        PopupMenuItem(value: _Sort.recent, child: Text('Recently updated')),
        PopupMenuItem(value: _Sort.id, child: Text('Bin number')),
      ],
      child: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        ),
        child: const Icon(Icons.tune_rounded, color: AppColors.textPrimary),
      ),
    );
  }
}

class _BinMap extends StatefulWidget {
  final List<Bin> bins;
  const _BinMap({super.key, required this.bins});

  @override
  State<_BinMap> createState() => _BinMapState();
}

class _BinMapState extends State<_BinMap> {
  final _map = MapController();
  Bin? _selected;

  List<Bin> get _valid =>
      widget.bins.where((b) => b.latitude != 0 || b.longitude != 0).toList();

  void _fitAll() {
    final pts = _valid.map((b) => LatLng(b.latitude, b.longitude)).toList();
    if (pts.isEmpty) return;
    if (pts.length == 1) {
      _map.move(pts.first, 15);
      return;
    }
    _map.fitCamera(
      CameraFit.coordinates(
        coordinates: pts,
        padding: const EdgeInsets.fromLTRB(60, 80, 60, 220),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final valid = _valid;
    var center = const LatLng(6.9271, 79.8612);
    if (valid.isNotEmpty) {
      center = LatLng(
        valid.map((b) => b.latitude).reduce((a, b) => a + b) / valid.length,
        valid.map((b) => b.longitude).reduce((a, b) => a + b) / valid.length,
      );
    }

    return Stack(
      children: [
        Positioned.fill(
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            child: FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: center,
                initialZoom: valid.length <= 1 ? 15 : 12,
                onMapReady: _fitAll,
                onTap: (_, __) => setState(() => _selected = null),
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                ),
              ),
              children: [
                visionWasteTileLayer(dark: true),
                MarkerLayer(
                  markers: valid.map((bin) {
                    final sel = _selected?.id == bin.id;
                    return Marker(
                      point: LatLng(bin.latitude, bin.longitude),
                      width: 52,
                      height: 52,
                      child: GestureDetector(
                        onTap: () {
                          setState(() => _selected = bin);
                          _map.move(
                            LatLng(bin.latitude, bin.longitude),
                            _map.camera.zoom < 15 ? 15 : _map.camera.zoom,
                          );
                        },
                        child: Center(
                          child: BinFillMarker(
                            fillLevel: bin.latestFillLevel,
                            fillPercentage: bin.latestFillPercentage,
                            selected: sel,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                RichAttributionWidget(
                  alignment: AttributionAlignment.bottomLeft,
                  attributions: [
                    TextSourceAttribution(visionWasteMapAttribution),
                  ],
                ),
              ],
            ),
          ),
        ),
        const Positioned(left: 16, top: 14, child: MapFillLegend()),
        Positioned(
          right: 16,
          top: 10,
          child: GlassIconButton(
            icon: Icons.fit_screen_rounded,
            tooltip: 'Show all bins',
            onTap: _fitAll,
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: kNavBarClearance - 8,
          child: AnimatedSwitcher(
            duration: Motion.medium,
            transitionBuilder: (child, anim) => SlideTransition(
              position: Tween(begin: const Offset(0, 0.4), end: Offset.zero)
                  .animate(anim),
              child: FadeTransition(opacity: anim, child: child),
            ),
            child: _selected == null
                ? const SizedBox.shrink()
                : _MapPreviewCard(
                    key: ValueKey(_selected!.id),
                    bin: _selected!,
                  ),
          ),
        ),
      ],
    );
  }
}

class _MapPreviewCard extends StatelessWidget {
  final Bin bin;
  const _MapPreviewCard({super.key, required this.bin});

  @override
  Widget build(BuildContext context) {
    final color = fillColor(bin.latestFillLevel);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: AppShadows.soft,
      ),
      child: Row(
        children: [
          LastCaptureThumbnail(
            imageUrl: bin.latestImageUrl,
            size: 64,
            fallback: IconTile(
              icon: fillIcon(bin.latestFillLevel),
              color: color,
              gradient: AppGradients.forFill(bin.latestFillLevel),
              size: 64,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(binCode(bin.id), style: AppText.title),
                Text(
                  bin.address ?? bin.location ?? bin.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.caption.copyWith(fontSize: 12),
                ),
                const SizedBox(height: 8),
                FillMeter(
                  fillLevel: bin.latestFillLevel,
                  fillPercentage: bin.latestFillPercentage,
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Pressable(
            onTap: () => context.push('/staff/bins/${bin.id}'),
            child: Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                gradient: AppGradients.brand,
                shape: BoxShape.circle,
                boxShadow: AppShadows.glow(AppColors.brand, strength: 0.4),
              ),
              child: const Icon(Icons.arrow_forward_rounded, color: Colors.white),
            ),
          ),
        ],
      ),
    ).animate().shimmer(duration: 900.ms, color: Colors.white10);
  }
}
