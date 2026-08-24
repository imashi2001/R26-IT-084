/**
 * PCM5102 I2S output — play on a dedicated FreeRTOS task (larger stack).
 * Playing inside the httpd task often yields OK JSON but silence / brownouts.
 *
 * Wiring: BCK=14  LRCK=13  DIN=15  SCK=GND  VIN=3V3  GND=GND
 * Use headphones or a powered amp on LINE OUT.
 */

#include "speaker.h"
#include <ESP_I2S.h>
#include <math.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static I2SClass s_i2s;
static bool s_pins_set = false;
static volatile bool s_busy = false;

enum PlayMode : uint8_t { MODE_TEST = 1, MODE_ALARM = 2 };

void speaker_begin() {
  s_i2s.setPins(I2S_BCK_PIN, I2S_WS_PIN, I2S_DOUT_PIN);
  s_pins_set = true;
  Serial.printf(
    "PCM5102 ready (task playback): BCK=%d LRCK=%d DIN=%d | SCK must be GND\n",
    I2S_BCK_PIN,
    I2S_WS_PIN,
    I2S_DOUT_PIN
  );
}

int speaker_pin() {
  return I2S_DOUT_PIN;
}

/** Loud square wave (easier to hear than a soft sine). */
static size_t play_square(float freq_hz, uint32_t duration_ms, int16_t level = 28000) {
  const uint32_t total_frames = (SPEAKER_SAMPLE_RATE * duration_ms) / 1000;
  const uint32_t half_period = (uint32_t)(SPEAKER_SAMPLE_RATE / (2.0f * freq_hz));
  if (half_period < 1) return 0;

  const size_t CHUNK = 256;
  int16_t buf[CHUNK * 2];
  uint32_t frames_left = total_frames;
  uint32_t phase = 0;
  int16_t sign = level;
  size_t written = 0;

  while (frames_left > 0) {
    size_t n = frames_left > CHUNK ? CHUNK : frames_left;
    for (size_t i = 0; i < n; i++) {
      buf[i * 2] = sign;
      buf[i * 2 + 1] = sign;
      phase++;
      if (phase >= half_period) {
        phase = 0;
        sign = (int16_t)(-sign);
      }
    }
    size_t bytes = n * 2 * sizeof(int16_t);
    size_t w = s_i2s.write((uint8_t *)buf, bytes);
    written += w;
    if (w < bytes) {
      vTaskDelay(1);
    }
    frames_left -= n;
  }
  return written;
}

static void silence_ms(uint32_t ms) {
  const uint32_t total_frames = (SPEAKER_SAMPLE_RATE * ms) / 1000;
  const size_t CHUNK = 256;
  int16_t buf[CHUNK * 2];
  memset(buf, 0, sizeof(buf));
  uint32_t frames_left = total_frames;
  while (frames_left > 0) {
    size_t n = frames_left > CHUNK ? CHUNK : frames_left;
    s_i2s.write((uint8_t *)buf, n * 2 * sizeof(int16_t));
    frames_left -= n;
  }
}

static void run_test_pattern() {
  Serial.println("Playing TEST pattern (square)");
  size_t w = play_square(1000, 800, 30000);
  Serial.printf("wrote %u bytes\n", (unsigned)w);
  silence_ms(100);
  play_square(1500, 500, 30000);
  silence_ms(100);
  play_square(2000, 500, 30000);
}

static void run_alarm_pattern() {
  Serial.println("Playing ALARM pattern (square)");
  size_t w = play_square(1800, 600, 32000);
  Serial.printf("wrote %u bytes\n", (unsigned)w);
  for (int i = 0; i < 4; i++) {
    play_square(1600, 250, 32000);
    silence_ms(80);
    play_square(700, 250, 32000);
    silence_ms(80);
  }
  play_square(2200, 600, 32000);
  silence_ms(100);
  play_square(2200, 600, 32000);
}

static void speaker_task(void *arg) {
  PlayMode mode = (PlayMode)(uintptr_t)arg;
  Serial.println("speaker_task start");

  if (!s_pins_set) {
    speaker_begin();
  }

  if (!s_i2s.begin(I2S_MODE_STD, SPEAKER_SAMPLE_RATE, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO)) {
    Serial.println("I2S begin FAILED");
    s_busy = false;
    vTaskDelete(NULL);
    return;
  }
  Serial.println("I2S begin OK");

  if (mode == MODE_ALARM) {
    run_alarm_pattern();
  } else {
    run_test_pattern();
  }

  delay(20);
  s_i2s.end();
  Serial.println("speaker_task done / I2S closed");
  s_busy = false;
  vTaskDelete(NULL);
}

static void start_play(PlayMode mode) {
  if (s_busy) {
    Serial.println("Speaker busy — skip");
    return;
  }
  s_busy = true;
  // Large stack — sine/square + I2S buffers need room (httpd task is too small)
  BaseType_t ok = xTaskCreatePinnedToCore(
    speaker_task,
    "vw_speaker",
    8192,
    (void *)(uintptr_t)mode,
    1,
    NULL,
    1
  );
  if (ok != pdPASS) {
    Serial.println("xTaskCreate failed");
    s_busy = false;
  }
}

void speaker_play_test() {
  Serial.println("=== queue Speaker TEST ===");
  start_play(MODE_TEST);
}

void speaker_play_alarm() {
  Serial.println("=== queue Speaker ALARM ===");
  start_play(MODE_ALARM);
}
