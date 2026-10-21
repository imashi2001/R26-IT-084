# VisionWaste — ESP32-CAM + PCM5102 wiring

## Wiring

| PCM5102 | ESP32-CAM | Notes |
|---------|-----------|--------|
| VIN | 3V3 | Power |
| GND | GND | Common ground |
| BCK | **GPIO 14** | Bit clock |
| LCK (LRCK) | **GPIO 13** | Word select |
| DIN | **GPIO 15** | Data |
| **SCK** | **GND** | Required or you get silence |

LINE OUT jack → headphones or powered speaker.

Do not use SD card with these pins. Do not use GPIO 16/17 (PSRAM).

## Test after flash

1. Serial: `PCM5102 I2S ready: BCK=14 WS/LRCK=13 DIN=15`
2. Browser: `http://<IP>/speaker/test` then `http://<IP>/alarm`
3. Bridge + website Speaker check as before

Full copy also lives in your sketch folder: `Desktop/Esp32cam/CameraWebServer/WIRING_PCM5102.md`
