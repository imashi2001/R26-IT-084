import '../services/api_client.dart';

/// Map tiles — MapTiler when a key is available, else CARTO/OSM.
///
/// Key sources (first match wins):
/// 1. `flutter run --dart-define=MAPTILER_KEY=...` (optional override)
/// 2. Backend `GET /map/config` — set `MAPTILER_KEY` on Railway
/// 3. CARTO fallback
class MapConfig {
  MapConfig._();

  static const String _compileTimeKey = String.fromEnvironment(
    'MAPTILER_KEY',
    defaultValue: '',
  );

  static String _runtimeKey = '';

  static String get apiKey {
    if (_compileTimeKey.isNotEmpty) return _compileTimeKey;
    return _runtimeKey;
  }

  static bool get useMapTiler => apiKey.isNotEmpty;

  static String tileUrl({bool dark = true}) {
    if (useMapTiler) {
      final style = dark ? 'dataviz-dark' : 'streets-v2';
      return 'https://api.maptiler.com/maps/$style/{z}/{x}/{y}.png?key=$apiKey';
    }
    if (dark) {
      return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    }
    return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  }

  static List<String>? get subdomains =>
      useMapTiler ? null : const ['a', 'b', 'c', 'd'];

  static String get attribution => useMapTiler
      ? '© MapTiler © OpenStreetMap contributors'
      : '© OpenStreetMap contributors © CARTO';

  /// Load MapTiler key from the Railway backend. Safe to call if offline.
  static Future<void> loadFromBackend() async {
    if (_compileTimeKey.isNotEmpty) return;
    try {
      final res = await ApiClient.instance.dio.get('/map/config');
      final data = res.data;
      if (data is Map) {
        final key = (data['maptiler_key'] as String?)?.trim() ?? '';
        if (key.isNotEmpty) _runtimeKey = key;
      }
    } catch (_) {
      // CARTO tiles still work without a key.
    }
  }
}
