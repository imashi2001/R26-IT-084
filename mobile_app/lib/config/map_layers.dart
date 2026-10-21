import 'package:flutter/widgets.dart';
import 'package:flutter_map/flutter_map.dart';
import 'map_config.dart';

/// Shared MapTiler / CARTO tile layer for VisionWaste maps.
TileLayer visionWasteTileLayer({bool dark = true}) {
  final subs = MapConfig.subdomains;
  return TileLayer(
    urlTemplate: MapConfig.tileUrl(dark: dark),
    subdomains: subs ?? const ['a', 'b', 'c', 'd'],
    userAgentPackageName: 'com.visionwaste.app',
    // Sharper @2x tiles on high-density phone screens.
    retinaMode: WidgetsBinding
            .instance.platformDispatcher.views.first.devicePixelRatio >
        1.5,
  );
}

String get visionWasteMapAttribution => MapConfig.attribution;
