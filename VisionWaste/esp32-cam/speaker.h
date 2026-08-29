/**
 * VisionWaste ESP32-CAM + PCM5102 I2S DAC
 *
 * Free pins on AI-Thinker ESP32-CAM (camera active, SD card NOT used, PSRAM OK):
 *   BCK  -> GPIO 14
 *   LRCK -> GPIO 13
 *   DIN  -> GPIO 15
 */

#pragma once

#include <Arduino.h>

#ifndef I2S_BCK_PIN
#define I2S_BCK_PIN 14
#endif
#ifndef I2S_WS_PIN
#define I2S_WS_PIN 13
#endif
#ifndef I2S_DOUT_PIN
#define I2S_DOUT_PIN 15
#endif

#ifndef SPEAKER_SAMPLE_RATE
#define SPEAKER_SAMPLE_RATE 16000
#endif

void speaker_begin();
void speaker_play_test();
void speaker_play_alarm();
int speaker_pin();
