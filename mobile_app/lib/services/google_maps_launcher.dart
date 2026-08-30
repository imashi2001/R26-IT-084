import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../domain/navigation_args.dart';

Future<bool> openGoogleMapsDriving({
  required double destLat,
  required double destLng,
  double? originLat,
  double? originLng,
  List<NavWaypoint>? waypoints,
  int activeIndex = 0,
}) async {
  final params = <String, String>{
    'api': '1',
    'destination': '$destLat,$destLng',
    'travelmode': 'driving',
  };

  if (originLat != null && originLng != null) {
    params['origin'] = '$originLat,$originLng';
  }

  if (waypoints != null && waypoints.length > 1) {
    final slice = waypoints.skip(activeIndex.clamp(0, waypoints.length - 1));
    final wp = slice
        .map((w) => '${w.latitude},${w.longitude}')
        .join('|');
    if (wp.isNotEmpty) {
      params['waypoints'] = wp;
    }
  }

  final uri = Uri.https('www.google.com', '/maps/dir/', params);
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}

Future<bool> openGoogleMapsToWaypoint(
  NavWaypoint target, {
  LatLng? origin,
  List<NavWaypoint>? allWaypoints,
  int activeIndex = 0,
}) {
  return openGoogleMapsDriving(
    destLat: target.latitude,
    destLng: target.longitude,
    originLat: origin?.latitude,
    originLng: origin?.longitude,
    waypoints: allWaypoints,
    activeIndex: activeIndex,
  );
}
