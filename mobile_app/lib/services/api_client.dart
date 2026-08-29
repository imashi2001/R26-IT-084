import 'package:dio/dio.dart';

// Change this to your Railway backend URL.
// e.g.  https://r26-it-084-production-3f77.up.railway.app
const String kBackendBaseUrl =
    'https://r26-it-084-production-3f77.up.railway.app';

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
}
