# VisionWaste ESP32-CAM firmware

Two deployment paths:

| Path | Firmware / script | Who calls `/predict` |
|------|-------------------|----------------------|
| **Direct (recommended)** | [`ESP32CamDirectPredict.ino`](ESP32CamDirectPredict.ino) | ESP32 over HTTPS |
| **Laptop bridge (legacy)** | [`../bridge/bridge.py`](../bridge/bridge.py) | Python bridge polls `http://<ESP32>/capture` |

## Direct ESP32 → Railway (ESP32CamDirectPredict.ino)

### Hardware

| Component | Connection |
|-----------|------------|
| Board | AI Thinker ESP32-CAM, OV2640 |
| PIR HC-SR501 | GPIO **14** |
| DFPlayer Mini | ESP32 **GPIO 13** (TX) → 1K → DFPlayer **RX** |
| DFPlayer | `0001.mp3`, `0002.mp3`, … on SD card |

Camera: UXGA 1600×1200, JPEG quality 8, PSRAM when available.

### Backend (Railway)

Set in Arduino sketch (or your own config):

- `BACKEND_BASE` / `PREDICT_URL` — e.g. `https://r26-it-084-production-3f77.up.railway.app`
- `ESP32_ID` — must match Admin device row (e.g. `esp-cam-1`)

Railway backend env:

- `AUTO_AUDIO_ON_PREDICT=true`
- All five `MODEL_*_URL` services configured
- Device registered with matching `esp32_id`

### HTTP concurrency

Long `/predict` uploads and short command polls use **separate** `WiFiClientSecure` + `HTTPClient` instances (no global mutex). The main loop polls `GET /devices/commands` every 2s even while a 120s predict POST is in flight.

Wi-Fi reconnect is deferred while an upload is active to avoid tearing down the upload socket.

```text
Main loop (responsive):
  PIR motion → enqueueCapture() → copy JPEG → upload queue
  Every 2s → GET /devices/commands → PLAY_AUDIO → DFPlayer → ACK
  Wi-Fi recovery

Background FreeRTOS task:
  POST /predict (waits for AI, up to 120s) — does NOT block main loop
```

Audio is **not** read from `/predict` JSON. The backend queues `PLAY_AUDIO` in `device_commands` after inference; the ESP32 polls commands every 2 seconds.

While AI runs (30–60s), PIR diagnostics and command polling continue. Audio plays as soon as the backend finishes and the next poll sees the command.

The backend re-delivers the same `PLAY_AUDIO` command every poll until the ESP32 ACKs it. The firmware tracks `activeAudioCommandId` so **each command plays once**; duplicate polls only retry ACK (up to 3 attempts), not DFPlayer replay.

### PIR behaviour

- 60 s warm-up after boot
- First motion → immediate capture/upload
- Motion continues → capture every 30 s
- PIR LOW 1 s → re-arm
- HIGH debounce 150 ms
- If upload still running at next interval → one **pending** capture after current upload finishes (no unlimited queue)

### Flash (Arduino IDE)

1. Open `ESP32CamDirectPredict.ino` in Arduino IDE.
2. Board: **AI Thinker ESP32-CAM**.
3. Set `WIFI_SSID`, `WIFI_PASSWORD`, `BACKEND_BASE`, `ESP32_ID`.
4. Upload; open Serial Monitor @ 115200.

### Serial Monitor test procedure

1. Boot: startup `0001.mp3`, Wi-Fi IP, PIR warm-up 60 s.
2. Trigger motion: within ~2 s see `Capture enqueued` and `[PIR]` diagnostics every 5 s **without** freezing.
3. During upload (~30–60 s): command poll still runs; optional Speaker Check test can play before predict finishes.
4. After backend finishes: `BACKEND COMMAND RECEIVED` → `PLAY_AUDIO` → `DFPLAYER PLAY TRACK: N` → ACK 200.
5. Hold PIR HIGH 30 s+: second capture; if upload busy, see `pending capture scheduled`.
6. Disconnect Wi-Fi during upload: reconnect logs; no crash.

### Memory

- One JPEG copy in PSRAM/heap per upload (queue depth 1).
- Multipart POST buffer allocated in PSRAM when possible.
- Only the main loop calls `esp_camera_fb_get()` / `esp_camera_fb_return()`.

---

## I2S speaker snippets (legacy / bridge path)

For **CameraWebServer** + laptop bridge LAN alarm (`GET /speaker/test`, `/alarm`):

| File | Purpose |
|------|---------|
| [`speaker.h`](speaker.h) / [`speaker.cpp`](speaker.cpp) | PCM5102 I2S tones (GPIO 14/13/15 — **conflicts with PIR/DFPlayer in DirectPredict sketch**) |
| [`app_httpd_speaker_snippet.cpp`](app_httpd_speaker_snippet.cpp) | HTTP handlers for bridge |

See [RUNBOOK.md](RUNBOOK.md) for bridge + I2S setup.

**Do not mix** I2S speaker pins with `ESP32CamDirectPredict.ino` (PIR on GPIO 14, DFPlayer on GPIO 13).

---

## Laptop bridge (optional)

[`../bridge/README.md`](../bridge/README.md) — polls ESP32 `/capture`, POSTs to `/predict`, relays `/speaker/test` from dashboard.

Not used when running `ESP32CamDirectPredict.ino`.
