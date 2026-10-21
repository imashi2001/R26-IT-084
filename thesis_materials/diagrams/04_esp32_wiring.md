# Figure: ESP32-CAM Hardware Wiring

**Caption:** *Wiring of AI Thinker ESP32-CAM with PIR motion sensor and DFPlayer Mini (DirectPredict path).*  
**Source:** `VisionWaste/esp32-cam/README.md`, `WIRING_PCM5102.md`

## Connection table (thesis Table)

| Component | ESP32-CAM pin | Notes |
|-----------|---------------|--------|
| PIR HC-SR501 OUT | **GPIO 14** | 3.3 V logic; VCC 5 V typical; GND common |
| PIR VCC | 5 V | Per HC-SR501 datasheet |
| PIR GND | GND | Common ground |
| DFPlayer RX | **GPIO 13** via **1 kΩ** | ESP TX → resistor → DFPlayer RX |
| DFPlayer VCC | 5 V | Separate supply if brownout |
| DFPlayer GND | GND | Common ground |
| DFPlayer SPK_1 / SPK_2 | Speaker | Or DAC out per module |
| OV2640 camera | Board FPC | On-module |
| Wi-Fi | On-chip | 2.4 GHz |

## ASCII wiring (quick sketch)

```text
                 +5V ----+---- PIR VCC
                         |
                        PIR
                         | OUT ---- GPIO14 (ESP32-CAM)
                 GND ----+---- PIR GND ---- GND (ESP)

  ESP32-CAM GPIO13 --[1k]--> DFPlayer RX
  ESP32-CAM GND ------------ DFPlayer GND
  +5V --------------------- DFPlayer VCC
  DFPlayer SPK_1/SPK_2 ---- Speaker

  ESP32-CAM 5V/USB -------- power (stable supply recommended)
```

## Important note for thesis

Legacy I2S PCM5102 wiring uses GPIO 14/13/15 and **conflicts** with PIR/DFPlayer in `ESP32CamDirectPredict.ino`. Your contribution uses the **DirectPredict + DFPlayer command-queue** path, not the I2S bridge alarm path.

## Photo checklist

Take clear photos for “List of Plates”:

1. Full assembled bin mount (camera facing bin interior/opening)  
2. Close-up PIR placement  
3. DFPlayer + SD card + speaker  
4. Power supply arrangement  
