/// Map tile configuration — MapTiler when built with MAPTILER_KEY, else CARTO/OSM fallback.
///
/// Run with key:
/// `flutter run --dart-define=MAPTILER_KEY=your_key_here`
///
/// Get your key: https://cloud.maptiler.com/account/keys/
class MapConfig {
  MapConfig._();

  /// Pass at build/run time: --dart-define=MAPTILER_KEY=...
  static const String apiKey = String.fromEnvironment(
    'MAPTILER_KEY',
    defaultValue: '',
  );

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
}
