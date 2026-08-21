# VisionWaste ESP32-CAM speaker

Drop-in buzzer helpers for Espressif **CameraWebServer**.

## Files

| File | Purpose |
|------|---------|
| `speaker.h` / `speaker.cpp` | GPIO buzzer tones (test + illegal alarm) |
| `app_httpd_speaker_snippet.cpp` | Copy handlers into `app_httpd.cpp` |

## Setup

1. Copy `speaker.h` and `speaker.cpp` into your Arduino sketch folder (same folder as `CameraWebServer.ino` / `app_httpd.cpp`).
2. Merge the handlers from `app_httpd_speaker_snippet.cpp` into `app_httpd.cpp` (register the three URIs on `camera_httpd`).
3. In `CameraWebServer.ino` `setup()`:

```cpp
#include "speaker.h"
// ...
speaker_begin();
startCameraServer();
```

## Wiring (prototype)

- Buzzer **+** → **GPIO 12** (`SPEAKER_GPIO`; change in `speaker.h` if needed). Use a transistor if current is high.
- Buzzer **−** → **GND**

## Routes

| URI | Sound |
|-----|--------|
| `GET /speaker/test` | Short ascending beeps |
| `GET /alarm` | Longer repeating “don’t throw” alarm |
| `GET /speaker/status` | JSON `{ ok, speaker_pin, wifi_ip }` |

## Verify (same Wi‑Fi)

```
http://<ESP32_IP>/capture
http://<ESP32_IP>/speaker/test
http://<ESP32_IP>/alarm
http://<ESP32_IP>/speaker/status
```

HTTPS Railway / the deployed website **cannot** call these LAN URLs. Use `VisionWaste/bridge` to relay **Test speaker** and auto `/alarm` after HIGH risk predictions.

See [RUNBOOK.md](RUNBOOK.md) for the full flash → Admin → bridge → Speaker Check sequence.
