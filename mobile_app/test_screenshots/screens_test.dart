// Renders every main screen with sample data and saves phone-sized PNGs.
//
// Not part of the normal `flutter test` run (golden output depends on the
// host OS fonts). Regenerate screenshots with:
//   flutter test test_screenshots/screens_test.dart --update-goldens
// Output: test_screenshots/goldens/*.png

import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:visionwaste/data/providers.dart';
import 'package:visionwaste/domain/models.dart';
import 'package:visionwaste/main.dart';
import 'package:visionwaste/router/app_router.dart';
import 'package:visionwaste/services/api_client.dart';

String _ago(Duration d) => DateTime.now().subtract(d).toUtc().toIso8601String();

final _bins = <Bin>[
  Bin(
    id: 3,
    name: 'Galle Face Green',
    address: 'Galle Rd, Colombo 03',
    latitude: 6.9271,
    longitude: 79.8452,
    latestFillLevel: 'overflow',
    latestFillPercentage: 94,
    latestRiskLevel: 'HIGH',
    latestCapturedAt: _ago(const Duration(minutes: 6)),
  ),
  Bin(
    id: 7,
    name: 'Pettah Market',
    address: 'Main St, Pettah',
    latitude: 6.9366,
    longitude: 79.8500,
    latestFillLevel: 'half',
    latestFillPercentage: 61,
    latestRiskLevel: 'MEDIUM',
    latestCapturedAt: _ago(const Duration(minutes: 22)),
  ),
  Bin(
    id: 12,
    name: 'Viharamahadevi Park',
    address: 'Green Path, Colombo 07',
    latitude: 6.9147,
    longitude: 79.8612,
    latestFillLevel: 'half',
    latestFillPercentage: 48,
    latestRiskLevel: 'LOW',
    latestCapturedAt: _ago(const Duration(hours: 1)),
  ),
  Bin(
    id: 15,
    name: 'Bambalapitiya Junction',
    address: 'Galle Rd, Colombo 04',
    latitude: 6.8890,
    longitude: 79.8560,
    latestFillLevel: 'empty',
    latestFillPercentage: 12,
    latestRiskLevel: 'LOW',
    latestCapturedAt: _ago(const Duration(hours: 2)),
  ),
  Bin(
    id: 18,
    name: 'Fort Railway Station',
    address: 'Olcott Mawatha, Fort',
    latitude: 6.9339,
    longitude: 79.8500,
    latestFillLevel: 'empty',
    latestFillPercentage: 20,
    latestCapturedAt: _ago(const Duration(hours: 3)),
  ),
  Bin(
    id: 21,
    name: 'Kollupitiya Beach',
    address: 'Marine Dr, Colombo 03',
    latitude: 6.9100,
    longitude: 79.8480,
    latestFillLevel: 'overflow',
    latestFillPercentage: 100,
    latestRiskLevel: 'CRITICAL',
    latestCapturedAt: _ago(const Duration(minutes: 41)),
  ),
];

final _alerts = <StaffAlert>[
  StaffAlert(
    id: 1,
    severity: 'critical',
    title: 'Bin overflowing',
    summary: 'BIN-021 reached 100% — schedule pickup.',
    status: 'open',
    deviceId: 21,
    createdAt: _ago(const Duration(minutes: 40)),
  ),
  StaffAlert(
    id: 2,
    severity: 'warning',
    title: 'Animal detected near bin',
    summary: '2 dogs detected around BIN-003.',
    status: 'open',
    deviceId: 3,
    createdAt: _ago(const Duration(hours: 2)),
  ),
  StaffAlert(
    id: 3,
    severity: 'critical',
    title: 'Littering event detected',
    summary: 'Illegal dumping beside BIN-007 (86% confidence).',
    status: 'acknowledged',
    deviceId: 7,
    createdAt: _ago(const Duration(hours: 5)),
  ),
  StaffAlert(
    id: 4,
    severity: 'info',
    title: 'High hygienic risk forecast',
    summary: 'Hot and humid afternoon — organic waste may rot faster.',
    status: 'open',
    createdAt: _ago(const Duration(days: 1, hours: 2)),
  ),
];

RiskForecast _forecast() {
  final now = DateTime.now();
  const levels = [
    'LOW', 'LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH',
    'MEDIUM', 'MEDIUM', 'LOW', 'LOW', 'MEDIUM', 'LOW',
  ];
  return RiskForecast(
    slots: [
      for (var i = 0; i < levels.length; i++)
        RiskSlot(
          time: now.add(Duration(hours: i * 2)),
          tempC: 27 + (i < 6 ? i : 12 - i).toDouble(),
          level: levels[i],
        ),
    ],
    maxLevel: 'HIGH',
    recommendation:
        'Schedule cleaning before 14:00 — risk is forecast to reach HIGH.',
  );
}

final _detail = BinLatest(
  device: _bins.first,
  capturedAt: _bins.first.latestCapturedAt,
  fillLevel: 'overflow',
  modelName: 'all',
  extras: const BinLatestExtras(
    wasteLabel: 'organic',
    wasteConfidence: 0.91,
    animalCount: 2,
    riskLevel: 'HIGH',
    riskCase: 'organic_hot_humid',
    tempC: 31.4,
    humidityPct: 78,
    fillPercentage: 94,
    litteringEventDetected: false,
  ),
);

final _captures = [
  for (var i = 0; i < 8; i++)
    CaptureRecord(
      id: 100 - i,
      capturedAt: _ago(Duration(hours: i * 3)),
      fillLevel: i < 2 ? 'overflow' : i < 5 ? 'half' : 'empty',
      fillPercentage: [94, 88, 70, 61, 52, 30, 18, 10][i].toDouble(),
    ),
];

class _FakeAuth extends AuthNotifier {
  _FakeAuth({required bool loggedIn}) {
    if (loggedIn) {
      state = const AuthState(
        user: AuthUser(
          id: 1,
          email: 'nimal.perera@cmc.gov.lk',
          role: 'admin',
          name: 'Nimal Perera',
          municipalCouncil: 'Colombo Municipal Council',
          coveredArea: 'Wards 1–12, Colombo 01–07',
        ),
      );
    }
  }
}

List<Override> _overrides({required bool loggedIn}) => [
      authProvider.overrideWith((_) => _FakeAuth(loggedIn: loggedIn)),
      mapBinsProvider.overrideWith((_) async => _bins),
      weatherProvider.overrideWith(
        (_) async => const WeatherNow(
          tempC: 30,
          humidityPct: 74,
          condition: 'Clouds',
        ),
      ),
      cityForecastProvider.overrideWith((_) async => _forecast()),
      staffAlertsProvider.overrideWith((_) async => _alerts),
      alertCountsProvider.overrideWith(
        (_) async => {'open': 3, 'acknowledged': 1, 'actioned': 4},
      ),
      dashboardSettingsProvider.overrideWith(
        (_) async => const DashboardSettings(),
      ),
      binDetailProvider.overrideWith((_, __) async => _detail),
      binCapturesProvider.overrideWith((_, __) async => _captures),
      binForecastProvider.overrideWith((_, __) async => _forecast()),
    ];

Future<void> _loadFonts() async {
  final poppins = FontLoader('Poppins');
  for (final w in ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']) {
    poppins.addFont(rootBundle.load('assets/fonts/Poppins-$w.ttf'));
  }
  await poppins.load();

  final flutterRoot = Platform.environment['FLUTTER_ROOT'] ?? 'C:/flutter';
  final iconFile = File(
    '$flutterRoot/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  if (iconFile.existsSync()) {
    final icons = FontLoader('MaterialIcons')
      ..addFont(Future.value(ByteData.sublistView(iconFile.readAsBytesSync())));
    await icons.load();
  }
}

Future<void> _shoot(
  WidgetTester tester, {
  required String name,
  required String path,
  bool loggedIn = true,
  Future<void> Function(WidgetTester)? before,
}) async {
  // flutter_test draws shadows without blur by default; show the real look.
  debugDisableShadows = false;
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;

  final container = ProviderContainer(overrides: _overrides(loggedIn: loggedIn));
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const VisionWasteApp(),
    ),
  );
  container.read(routerProvider).go(path);
  for (var i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
  if (before != null) await before(tester);

  await expectLater(
    find.byType(VisionWasteApp),
    matchesGoldenFile('goldens/$name.png'),
  );

  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 5));
  container.dispose();
  tester.view.reset();
  debugDisableShadows = true;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await _loadFonts();
    ApiClient.instance.init();
    const secure = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(secure, (_) async => null);
    const geo = MethodChannel('flutter.baseflow.com/geolocator');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(geo, (call) async {
      switch (call.method) {
        case 'checkPermission':
        case 'requestPermission':
          return 3; // whileInUse
        case 'isLocationServiceEnabled':
          return true;
        default:
          return {
            'latitude': 6.9200,
            'longitude': 79.8540,
            'timestamp': DateTime.now().millisecondsSinceEpoch,
            'accuracy': 5.0,
            'altitude': 0.0,
            'heading': 0.0,
            'speed': 0.0,
            'speed_accuracy': 0.0,
          };
      }
    });
  });

  testWidgets('01 home', (t) => _shoot(t, name: '01_home', path: '/', loggedIn: false));
  testWidgets('02 login',
      (t) => _shoot(t, name: '02_login', path: '/staff/login', loggedIn: false));
  testWidgets('03 dashboard',
      (t) => _shoot(t, name: '03_dashboard', path: '/staff/dashboard'));
  testWidgets('04 dashboard scrolled', (t) => _shoot(
        t,
        name: '04_dashboard_scrolled',
        path: '/staff/dashboard',
        before: (t) async {
          await t.drag(find.byType(Scrollable).first, const Offset(0, -900));
          for (var i = 0; i < 8; i++) {
            await t.pump(const Duration(milliseconds: 250));
          }
        },
      ));
  testWidgets('05 bins', (t) => _shoot(t, name: '05_bins', path: '/staff/bins'));
  testWidgets('06 bin detail',
      (t) => _shoot(t, name: '06_bin_detail', path: '/staff/bins/3'));
  testWidgets('07 bin detail scrolled', (t) => _shoot(
        t,
        name: '07_bin_detail_scrolled',
        path: '/staff/bins/3',
        before: (t) async {
          await t.drag(find.byType(Scrollable).first, const Offset(0, -700));
          for (var i = 0; i < 8; i++) {
            await t.pump(const Duration(milliseconds: 250));
          }
        },
      ));
  testWidgets('08 alerts', (t) => _shoot(t, name: '08_alerts', path: '/staff/alerts'));
  testWidgets('09 profile', (t) => _shoot(t, name: '09_profile', path: '/staff/more'));
}
