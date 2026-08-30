import 'package:dio/dio.dart';
import '../domain/models.dart';

/// Fetches driving routes from OSRM (free, no API key required).
class OsrmService {
  OsrmService._();
  static final instance = OsrmService._();

  final _dio = Dio(BaseOptions(
    baseUrl: 'https://router.project-osrm.org',
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
  ));

  RouteResult _straightPath(List<List<double>> points) => RouteResult(
        path: points,
        approximate: true,
      );

  RouteResult? _parseRouteResponse(Map<String, dynamic> data) {
    if (data['code'] != 'Ok') return null;
    final routes = data['routes'] as List?;
    if (routes == null || routes.isEmpty) return null;

    final route = routes[0] as Map<String, dynamic>;
    final coords = (route['geometry']['coordinates'] as List?)
        ?.cast<List<dynamic>>();
    if (coords == null || coords.isEmpty) return null;

    final path = coords
        .map((c) => [
              (c[1] as num).toDouble(),
              (c[0] as num).toDouble(),
            ])
        .toList();

    return RouteResult(
      path: path,
      approximate: false,
      distanceMeters: (route['distance'] as num?)?.toDouble(),
      durationSeconds: (route['duration'] as num?)?.toDouble(),
    );
  }

  Future<RouteResult> drivingRoute(
    double fromLat,
    double fromLng,
    double toLat,
    double toLng,
  ) async {
    final straight = _straightPath([
      [fromLat, fromLng],
      [toLat, toLng],
    ]);

    try {
      final url =
          '/route/v1/driving/$fromLng,$fromLat;$toLng,$toLat'
          '?overview=full&geometries=geojson';
      final res = await _dio.get(url);
      return _parseRouteResponse(res.data as Map<String, dynamic>) ?? straight;
    } catch (_) {
      return straight;
    }
  }

  /// Single OSRM request for many stops — much faster than leg-by-leg.
  Future<RouteResult> drivingRouteMulti(List<List<double>> latLngPoints) async {
    if (latLngPoints.length < 2) {
      return _straightPath(latLngPoints);
    }

    final straight = _straightPath(latLngPoints);

    try {
      final coordStr = latLngPoints
          .map((p) => '${p[1]},${p[0]}') // lng,lat
          .join(';');
      final url =
          '/route/v1/driving/$coordStr?overview=full&geometries=geojson';
      final res = await _dio.get(url);
      return _parseRouteResponse(res.data as Map<String, dynamic>) ?? straight;
    } catch (_) {
      return straight;
    }
  }
}
