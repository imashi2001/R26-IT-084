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
}
