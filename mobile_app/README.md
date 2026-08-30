# VisionWaste Mobile App (Android)

Flutter Android app for the VisionWaste bin-level monitoring system.

## Features
- **Public users** — find nearest bin by GPS, see fill level + risk, view driving route preview on OSM map, open Google Maps for turn-by-turn navigation.
- **Municipal staff** — JWT login, bottom navigation (Dashboard · Bins · Routes · Alerts · More), collection route planning, alerts feed, bin detail with map preview.

## Staff navigation (5 tabs)
| Tab | Route | Purpose |
|-----|-------|---------|
| Dashboard | `/staff/dashboard` | KPIs, priority bins, fleet summary |
| Bins | `/staff/bins` | List + map; tap opens bin detail |
| Routes | `/staff/routes` | GPS collection plan + map + Start Navigation |
| Alerts | `/staff/alerts` | Critical / warning / info feed from backend |
| More | `/staff/more` | Profile, shortcuts, sign out |

Bin detail (`/staff/bins/:id`) opens as a full-screen overlay with a working back arrow (uses `context.push` + root navigator).

## Project structure
```
lib/
  main.dart                       app entry
  theme/app_theme.dart            Material3 dark theme + color palette
  domain/models.dart              pure data models (Bin, NearestBinResult, BinLatest, AuthUser, RouteResult)
  services/
    api_client.dart               Dio HTTP client (set kBackendBaseUrl here)
    auth_storage.dart             secure JWT storage
  data/
    bin_repository.dart           calls backend endpoints
    osrm_service.dart             free OSRM driving-route fetch
    providers.dart                Riverpod providers (auth, nearest, mapBins, binDetail)
  router/app_router.dart          go_router routes + auth guard
  presentation/
    home_screen.dart              role selector landing screen
    public/
      public_nearest_screen.dart  full-screen OSM map + nearest bins + route panel
    staff/
      staff_shell.dart              bottom nav + drawer + shared app bar
      staff_dashboard_screen.dart   home KPI dashboard
      staff_bins_screen.dart        list + map tabs
      staff_routes_screen.dart      collection route map + stops
      staff_alerts_screen.dart      alert feed with filters
      staff_more_screen.dart        profile + settings
      staff_login_screen.dart       JWT login form
      staff_bin_detail_screen.dart  bin detail (mockup layout)
    shared/widgets.dart           BinLevelCard, RiskBadge, FillMeter, ErrorState, CentredLoader
```

## 1. Prerequisites

Use **Flutter 3.32+ / 3.47+** (not 3.24). That engine is **16 KB page-size compatible** and removes the debug warning on newer Android phones.

```powershell
flutter upgrade
flutter doctor
```

| Tool | Install |
|------|---------|
| Flutter SDK | https://flutter.dev/docs/get-started/install/windows → unzip to `C:\src\flutter` → add `C:\src\flutter\bin` to PATH |
| Android Studio | https://developer.android.com/studio — also installs the Android SDK |
| JDK 17+ | usually installed with Android Studio |

Verify with:
```powershell
flutter doctor
```
All items should have ✓ except Chrome (not needed).

## 2. Update backend URL
Open `lib/services/api_client.dart` and set:
```dart
const String kBackendBaseUrl = 'https://r26-it-084-production-3f77.up.railway.app';
```

## 3. Install dependencies
```powershell
cd mobile_app
flutter pub get
```

### MapTiler (optional)

Maps use **MapTiler** when you pass your API key at run/build time; otherwise free **CARTO/OpenStreetMap** tiles are used.

1. Get a key: [MapTiler Cloud → API keys](https://cloud.maptiler.com/account/keys/)
2. Run or build with:
   ```powershell
   flutter run --dart-define=MAPTILER_KEY=your_key_here
   flutter build apk --release --dart-define=MAPTILER_KEY=your_key_here
   ```

Config: `lib/config/map_config.dart` · shared layer: `lib/config/map_layers.dart`

## 4. Run on a device / emulator
```powershell
flutter run
```
- Or select a device in Android Studio and press **Run**.

## 5. Build a debug APK (for testing)
```powershell
flutter build apk --debug
```
Output: `build/app/outputs/flutter-apk/app-debug.apk`
Transfer to your phone and install (enable "Install from unknown sources").

## 6. Build a release APK
```powershell
flutter build apk --release
```
Output: `build/app/outputs/flutter-apk/app-release.apk`

This uses debug signing keys by default (enough for internal testing). For Google Play you need a proper keystore — see the signing section below.

## 7. Proper signing (Google Play / distribution)

### Generate a keystore (one-time)
```powershell
cd android
keytool -genkey -v -keystore key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias visionwaste
```

### Configure signing
Add to `android/app/build.gradle` inside `android {}`:
```groovy
signingConfigs {
    release {
        storeFile file("../../key.jks")
        storePassword "YOUR_STORE_PASSWORD"
        keyAlias "visionwaste"
        keyPassword "YOUR_KEY_PASSWORD"
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```
Then rebuild:
```powershell
flutter build apk --release
```

## 8. Find the APK
| Build type | Path |
|------------|------|
| Debug      | `mobile_app/build/app/outputs/flutter-apk/app-debug.apk` |
| Release    | `mobile_app/build/app/outputs/flutter-apk/app-release.apk` |
