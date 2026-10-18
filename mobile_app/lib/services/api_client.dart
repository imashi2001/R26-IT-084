import 'package:dio/dio.dart';

/// Railway backend URL. Override per build without editing code:
/// `flutter run --dart-define=API_BASE_URL=https://your-backend.up.railway.app`
const String kBackendBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://r26-it-084-production-2220.up.railway.app',
);

class ApiClient {
  ApiClient._();
  static ApiClient? _instance;
  static ApiClient get instance => _instance ??= ApiClient._();

  late Dio _dio;
  String? _token;

  void init() {
    _dio = Dio(
      BaseOptions(
        baseUrl: kBackendBaseUrl,
        connectTimeout: const Duration(seconds: 12),
        receiveTimeout: const Duration(seconds: 20),
        headers: {'Content-Type': 'application/json'},
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_token != null) {
            options.headers['Authorization'] = 'Bearer $_token';
          }
          return handler.next(options);
        },
      ),
    );
  }

  void setToken(String? token) => _token = token;
  String? get token => _token;

  Dio get dio => _dio;

  /// Headers for loading protected backend images (capture photos).
  /// Only attached for our own backend so the token never leaks elsewhere.
  Map<String, String>? imageHeadersFor(String url) {
    if (_token == null || !url.startsWith(kBackendBaseUrl)) return null;
    return {'Authorization': 'Bearer $_token'};
  }

  /// Absolute URL of a capture photo (requires staff login).
  String captureImageUrl(int captureId) =>
      '$kBackendBaseUrl/captures/$captureId/image';
}
