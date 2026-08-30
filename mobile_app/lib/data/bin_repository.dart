import 'package:dio/dio.dart';
import '../domain/models.dart';
import '../services/api_client.dart';

class BinRepository {
  BinRepository._();
  static final instance = BinRepository._();

  Dio get _dio => ApiClient.instance.dio;

  // ── Auth ────────────────────────────────────────────────────────────────────

  Future<({String token, AuthUser user})> login(
      String email, String password) async {
    final res = await _dio.post('/auth/login',
        data: {'email': email, 'password': password});
    final token = res.data['token'] as String;
    final user = AuthUser.fromJson(res.data['user'] as Map<String, dynamic>);
    return (token: token, user: user);
  }

  // ── Devices ─────────────────────────────────────────────────────────────────

  Future<List<NearestBinResult>> nearest(
      double lat, double lng, {int limit = 5}) async {
    final res = await _dio.get('/devices/nearest', queryParameters: {
      'lat': lat,
      'lng': lng,
      'limit': limit,
    });
    final list = (res.data['results'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    return list.map(NearestBinResult.fromJson).toList();
  }

  Future<List<Bin>> mapBins() async {
    final res = await _dio.get('/devices/map');
    final list = (res.data['bins'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    return list.map(Bin.fromJson).toList();
  }

  Future<BinLatest> latestForDevice(int id) async {
    final res = await _dio.get('/devices/$id/latest');
    return BinLatest.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<StaffAlert>> alerts({String status = 'all', int limit = 50}) async {
    final res = await _dio.get('/alerts', queryParameters: {
      'status': status,
      'limit': limit,
    });
    final list = (res.data['alerts'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    return list.map(StaffAlert.fromJson).toList();
  }

  Future<Map<String, int>> alertStatusCounts() async {
    final res = await _dio.get('/alerts', queryParameters: {'limit': 1});
    final counts = res.data['status_counts'];
    if (counts is Map) {
      return counts.map((k, v) => MapEntry(k.toString(), (v as num).toInt()));
    }
    return {};
  }

  Future<CollectionPlan> collectionPlan({
    required double latitude,
    required double longitude,
  }) async {
    final res = await _dio.post('/collection/plan', data: {
      'start': {'latitude': latitude, 'longitude': longitude},
      'start_mode': 'gps',
    });
    return CollectionPlan.fromJson(res.data as Map<String, dynamic>);
  }
}
