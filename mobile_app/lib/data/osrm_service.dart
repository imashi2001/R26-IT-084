import 'package:dio/dio.dart';
import '../domain/models.dart';

/// Fetches a driving route from OSRM (free, no API key required).
/// Falls back to a straight-line route on any error.
class OsrmService {
  OsrmService._();
  static final instance = OsrmService._();

  final _dio = Dio(BaseOptions(
    baseUrl: 'https://router.project-osrm.org',
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
  ));

  Future<RouteResult> drivingRoute(
    double fromLat, double fromLng,
    double toLat,   double toLng,
  ) async {
    final straight = RouteResult(
      path: [
        [fromLat, fromLng],
        [toLat, toLng],
      ],
      approximate: true,
    );

    try {
      final url =
          '/route/v1/driving/$fromLng,$fromLat;$toLng,$toLat'
          '?overview=full&geometries=geojson';
      final res = await _dio.get(url);
      final data = res.data as Map<String, dynamic>;

      if (data['code'] != 'Ok') return straight;
      final routes = data['routes'] as List?;
      if (routes == null || routes.isEmpty) return straight;

      final coords = (routes[0]['geometry']['coordinates'] as List?)
          ?.cast<List<dynamic>>();
      if (coords == null || coords.isEmpty) return straight;

      final path = coords
          .map((c) => [
                (c[1] as num).toDouble(), // lat
                (c[0] as num).toDouble(), // lng
              ])
          .toList();

      return RouteResult(path: path, approximate: false);
    } catch (_) {
      return straight;
    }
  }
}
