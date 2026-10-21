# End-to-end: ESP32 speaker + Speaker Check

## 1. Firmware

1. Copy [`speaker.h`](speaker.h) and [`speaker.cpp`](speaker.cpp) into your Arduino CameraWebServer sketch folder.
2. Merge handlers from [`app_httpd_speaker_snippet.cpp`](app_httpd_speaker_snippet.cpp) into `app_httpd.cpp`.
3. Call `speaker_begin()` in `setup()` before `startCameraServer()`.
4. Wire buzzer to **GPIO 12** (+ and GND).
5. Flash; note Serial IP.

Verify on the same Wi‑Fi:

- `http://<IP>/capture`
- `http://<IP>/speaker/test` (short ascending beeps)
- `http://<IP>/alarm` (longer “don’t throw” pattern)

## 2. Admin bin

1. Login as admin → **Admin** / Settings.
2. Set **ESP32 ID** to something like `esp-cam-1` (not the `BRIDGE_…` laptop id).
3. Set **Bridge / Laptop ID** from bridge startup / `.bridge_id`.
4. Set **Camera base URL** to `http://<IP>` (no `/capture`).

## 3. Bridge

```powershell
cd VisionWaste\bridge
.\.venv\Scripts\Activate.ps1
$env:ESP32_CAPTURE_URL = "http://<IP>/capture"
$env:BACKEND_PREDICT_URL = "https://r26-it-084-production-3f77.up.railway.app/predict"
$env:DEVICE_ESP32_ID = "esp-cam-1"
python bridge.py
```

Keep this running.

## 4. Website Speaker Check

1. Open **Speaker check** (nav or sidebar).
2. Click **Test speaker** on the bin.
3. Within ~5 seconds the bridge should log `ESP32 speaker → …/speaker/test` and the buzzer should sound.

## 5. Auto alarm

When `/predict` returns **HIGH** / **CRITICAL** risk or animal detections, the bridge calls `/alarm` automatically.

## DB columns (if not using Sequelize alter sync)

```sql
ALTER TABLE devices ADD COLUMN IF NOT EXISTS camera_base_url VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS pending_speaker_action VARCHAR(16);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS pending_speaker_at TIMESTAMPTZ;
```

Or set `DB_SYNC=true` and `DB_SYNC_ALTER=true` once on the backend.
