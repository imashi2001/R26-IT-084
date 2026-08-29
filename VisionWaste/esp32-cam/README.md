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

## Wiring (PCM5102 I2S DAC)

| PCM5102 | ESP32-CAM |
|---------|-----------|
| VIN | 3V3 |
| GND | GND |
| BCK | GPIO **14** |
| LCK | GPIO **13** |
| DIN | GPIO **15** |
| **SCK** | **GND** (required) |

See [WIRING_PCM5102.md](WIRING_PCM5102.md). `/speaker/test` and `/alarm` play sine tones through the DAC (Arduino-ESP32 3.x `ESP_I2S.h`).


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
