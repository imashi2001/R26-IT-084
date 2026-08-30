import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

const _earthRadiusM = 6371000.0;

double haversineMeters(LatLng a, LatLng b) {
  final dLat = _deg2rad(b.latitude - a.latitude);
  final dLng = _deg2rad(b.longitude - a.longitude);
  final lat1 = _deg2rad(a.latitude);
  final lat2 = _deg2rad(b.latitude);
  final h = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(lat1) *
          math.cos(lat2) *
          math.sin(dLng / 2) *
          math.sin(dLng / 2);
  return _earthRadiusM * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));
}

double _deg2rad(double deg) => deg * math.pi / 180;

double polylineLengthMeters(List<LatLng> points) {
  if (points.length < 2) return 0;
  var total = 0.0;
  for (var i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

/// Rough remaining distance: from user to closest point on route, then to end.
double remainingRouteMeters(LatLng user, List<LatLng> route) {
  if (route.isEmpty) return 0;
  if (route.length == 1) return haversineMeters(user, route.first);

  var closestIndex = 0;
  var closestDist = double.infinity;
  for (var i = 0; i < route.length; i++) {
    final d = haversineMeters(user, route[i]);
    if (d < closestDist) {
      closestDist = d;
      closestIndex = i;
    }
  }

  var remaining = closestDist;
  for (var i = closestIndex; i < route.length - 1; i++) {
    remaining += haversineMeters(route[i], route[i + 1]);
  }
  return remaining;
}

int estimateDurationSeconds(double meters, {double speedKmh = 35}) {
  if (meters <= 0 || speedKmh <= 0) return 0;
  return (meters / 1000 / speedKmh * 3600).ceil();
}

String formatDurationShort(int totalSeconds) {
  if (totalSeconds <= 0) return '—';
  if (totalSeconds < 60) return '${totalSeconds}s';
  final mins = (totalSeconds / 60).ceil();
  if (mins < 60) return '$mins min';
  final h = mins ~/ 60;
  final m = mins % 60;
  return m == 0 ? '${h}h' : '${h}h ${m}m';
}

List<LatLng> pathFromCoords(List<List<double>> coords) {
  return coords.map((c) => LatLng(c[0], c[1])).toList();
}
