import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../data/providers.dart';
import '../../domain/models.dart';
import '../../config/map_layers.dart';
import '../../theme/app_theme.dart';
import '../shared/widgets.dart';
import 'staff_shell.dart';

class StaffBinsScreen extends ConsumerStatefulWidget {
  const StaffBinsScreen({super.key});

  @override
  ConsumerState<StaffBinsScreen> createState() => _StaffBinsScreenState();
}

class _StaffBinsScreenState extends ConsumerState<StaffBinsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(mapBinsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const StaffDrawer(),
      appBar: StaffAppBar(
        title: 'Bins',
        showMenu: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(mapBinsProvider),
          ),
        ],
      ),
      body: async.when(
        loading: () => const CentredLoader(label: 'Loading bins…'),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(mapBinsProvider),
        ),
        data: (bins) => Column(
          children: [
            TabBar(
              controller: _tabs,
              indicatorColor: AppColors.brand,
              labelColor: AppColors.brand,
              unselectedLabelColor: AppColors.textSecondary,
              tabs: const [
                Tab(icon: Icon(Icons.list_alt_outlined), text: 'List'),
                Tab(icon: Icon(Icons.map_outlined), text: 'Map'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabs,
                children: [
                  _BinList(bins: bins),
                  _BinMap(bins: bins),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BinList extends StatefulWidget {
  final List<Bin> bins;
  const _BinList({required this.bins});

  @override
  State<_BinList> createState() => _BinListState();
}

class _BinListState extends State<_BinList> {
  String _filter = 'all';

  List<Bin> get _filtered {
    if (_filter == 'all') return widget.bins;
    return widget.bins
        .where((b) => (b.latestFillLevel ?? '').toLowerCase() == _filter)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final bins = widget.bins;
    if (bins.isEmpty) {
      return const ErrorState(message: 'No bins registered yet.');
    }

    final overflow = bins
        .where((b) => (b.latestFillLevel ?? '').toLowerCase() == 'overflow')
        .length;
    final half = bins
        .where((b) => (b.latestFillLevel ?? '').toLowerCase() == 'half')
        .length;
    final empty = bins
        .where((b) => (b.latestFillLevel ?? '').toLowerCase() == 'empty')
        .length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: _SummaryChip(
                  label: 'Total',
                  value: '${bins.length}',
                  selected: _filter == 'all',
                  onTap: () => setState(() => _filter = 'all'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _SummaryChip(
                  label: 'Full',
                  value: '$overflow',
                  color: AppColors.riskHigh,
                  selected: _filter == 'overflow',
                  onTap: () => setState(() => _filter = 'overflow'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _SummaryChip(
                  label: 'Half',
                  value: '$half',
                  color: AppColors.riskMedium,
                  selected: _filter == 'half',
                  onTap: () => setState(() => _filter = 'half'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _SummaryChip(
                  label: 'Empty',
                  value: '$empty',
                  color: AppColors.fillEmpty,
                  selected: _filter == 'empty',
                  onTap: () => setState(() => _filter = 'empty'),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: _filtered.isEmpty
              ? const ErrorState(message: 'No bins in this filter.')
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final b = _filtered[i];
                    return PriorityBinTile(
                      bin: b,
                      onTap: () => context.push('/staff/bins/${b.id}'),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool selected;
  final VoidCallback? onTap;
  const _SummaryChip({
    required this.label,
    required this.value,
    this.color = AppColors.brand,
    this.selected = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha: selected ? 0.22 : 0.1),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: color.withValues(alpha: selected ? 0.9 : 0.4),
              width: selected ? 1.5 : 1,
            ),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: color.withValues(alpha: 0.2),
                      blurRadius: 8,
                    ),
                  ]
                : null,
          ),
          child: Column(
            children: [
              Text(
                value,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: color,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 10,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BinMap extends StatelessWidget {
  final List<Bin> bins;
  const _BinMap({required this.bins});

  @override
  Widget build(BuildContext context) {
    final validBins =
        bins.where((b) => b.latitude != 0 || b.longitude != 0).toList();

    LatLng center = const LatLng(7.8731, 80.7718);
    if (validBins.isNotEmpty) {
      final lat = validBins.map((b) => b.latitude).reduce((a, b) => a + b) /
          validBins.length;
      final lng = validBins.map((b) => b.longitude).reduce((a, b) => a + b) /
          validBins.length;
      center = LatLng(lat, lng);
    }

    return Stack(
      children: [
        FlutterMap(
          options: MapOptions(
            initialCenter: center,
            initialZoom: validBins.length <= 1 ? 14 : 10,
          ),
          children: [
            visionWasteTileLayer(dark: true),
            MarkerLayer(
              markers: validBins.map((bin) {
                return Marker(
                  point: LatLng(bin.latitude, bin.longitude),
                  width: 44,
                  height: 44,
                  child: GestureDetector(
                    onTap: () => context.push('/staff/bins/${bin.id}'),
                    child: BinFillMarker(
                      fillLevel: bin.latestFillLevel,
                      fillPercentage: bin.latestFillPercentage,
                    ),
                  ),
                );
              }).toList(),
            ),
            RichAttributionWidget(attributions: [
              TextSourceAttribution(visionWasteMapAttribution),
            ]),
          ],
        ),
        const Positioned(left: 12, top: 12, child: MapFillLegend()),
      ],
    );
  }
}
