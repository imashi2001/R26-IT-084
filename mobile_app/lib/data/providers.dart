import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/models.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';
import 'bin_repository.dart';
import 'osrm_service.dart';

// ── Auth state ────────────────────────────────────────────────────────────────

class AuthState {
  final bool loading;
  final AuthUser? user;
  final String? error;
  const AuthState({this.loading = false, this.user, this.error});
  bool get isLoggedIn => user != null;
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState()) {
    _restore();
  }

  Future<void> _restore() async {
    final token = await AuthStorage.instance.readToken();
    final user  = await AuthStorage.instance.readUser();
    if (token != null && user != null) {
      ApiClient.instance.setToken(token);
      state = AuthState(user: user);
    }
  }

  Future<void> login(String email, String password) async {
    state = const AuthState(loading: true);
    try {
      final r = await BinRepository.instance.login(email, password);
      ApiClient.instance.setToken(r.token);
      await AuthStorage.instance.save(r.token, r.user);
      state = AuthState(user: r.user);
    } on Exception catch (e) {
      state = AuthState(error: _msg(e));
    }
  }

  Future<void> logout() async {
    ApiClient.instance.setToken(null);
    await AuthStorage.instance.clear();
    state = const AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (_) => AuthNotifier(),
);

// ── Nearest bins (public) ──────────────────────────────────────────────────────

class NearestState {
  final bool loading;
  final List<NearestBinResult> bins;
  final NearestBinResult? selected;
  final RouteResult? route;
  final String? error;
  const NearestState({
    this.loading = false,
    this.bins = const [],
    this.selected,
    this.route,
    this.error,
  });
  NearestState copyWith({
    bool? loading,
    List<NearestBinResult>? bins,
    NearestBinResult? selected,
    RouteResult? route,
    String? error,
    bool clearRoute = false,
    bool clearError = false,
    bool clearSelected = false,
  }) =>
      NearestState(
        loading:  loading  ?? this.loading,
        bins:     bins     ?? this.bins,
        selected: clearSelected ? null : (selected ?? this.selected),
        route:    clearRoute    ? null : (route    ?? this.route),
        error:    clearError    ? null : (error    ?? this.error),
      );
}

class NearestNotifier extends StateNotifier<NearestState> {
  NearestNotifier() : super(const NearestState());

  Future<void> fetch(double lat, double lng) async {
    state = state.copyWith(
        loading: true, clearError: true, clearRoute: true, clearSelected: true);
    try {
      final bins = await BinRepository.instance.nearest(lat, lng, limit: 5);
      state = state.copyWith(loading: false, bins: bins);
    } on Exception catch (e) {
      state = state.copyWith(loading: false, error: _msg(e));
    }
  }

  Future<void> selectBin(
    NearestBinResult bin,
    double userLat, double userLng,
  ) async {
    state = state.copyWith(selected: bin, clearRoute: true);
    final route = await OsrmService.instance.drivingRoute(
        userLat, userLng, bin.latitude, bin.longitude);
    state = state.copyWith(route: route);
  }

  void clear() => state = const NearestState();
}

final nearestProvider =
    StateNotifierProvider<NearestNotifier, NearestState>(
  (_) => NearestNotifier(),
);

// ── Map bins (staff) ──────────────────────────────────────────────────────────

final mapBinsProvider = FutureProvider<List<Bin>>((_) async {
  return BinRepository.instance.mapBins();
});

// ── Bin detail (staff) ────────────────────────────────────────────────────────

final binDetailProvider =
    FutureProvider.family<BinLatest, int>((_, id) async {
  return BinRepository.instance.latestForDevice(id);
});

// ── helpers ───────────────────────────────────────────────────────────────────

String _msg(Exception e) {
  final s = e.toString();
  if (e is DioException) {
    final d = e.response?.data;
    if (d is Map && d['error'] != null) return d['error'] as String;
    return 'Server error ${e.response?.statusCode ?? ''}';
  }
  return s.replaceFirst('Exception: ', '');
}
