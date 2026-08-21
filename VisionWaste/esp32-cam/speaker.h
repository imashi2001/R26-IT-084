/**
 * VisionWaste ESP32-CAM — buzzer / speaker helpers
 *
 * Default: passive or active buzzer on SPEAKER_GPIO (GPIO 12).
 * Paste speaker.cpp logic into your Arduino sketch, or add both files
 * to the CameraWebServer project and call speaker_begin() from setup().
 */

#pragma once

#include <Arduino.h>

#ifndef SPEAKER_GPIO
#define SPEAKER_GPIO 12
#endif

void speaker_begin();
void speaker_play_test();
void speaker_play_alarm();
int speaker_pin();
