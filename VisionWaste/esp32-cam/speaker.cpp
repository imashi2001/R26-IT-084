#include "speaker.h"
#include "esp32-hal-ledc.h"

static bool s_ready = false;

void speaker_begin() {
  // 8-bit PWM @ 2 kHz base; we change frequency per note via ledcWriteTone-style API.
  ledcAttach(SPEAKER_GPIO, 2000, 8);
  ledcWrite(SPEAKER_GPIO, 0);
  s_ready = true;
}

int speaker_pin() {
  return SPEAKER_GPIO;
}

static void tone_ms(uint32_t freq_hz, uint32_t ms) {
  if (!s_ready) return;
  if (freq_hz == 0) {
    ledcWrite(SPEAKER_GPIO, 0);
    delay(ms);
    return;
  }
  ledcWriteTone(SPEAKER_GPIO, freq_hz);
  delay(ms);
  ledcWriteTone(SPEAKER_GPIO, 0);
  ledcWrite(SPEAKER_GPIO, 0);
}

/** Short ascending beeps — manual website / LAN test. */
void speaker_play_test() {
  tone_ms(880, 120);
  delay(60);
  tone_ms(988, 120);
  delay(60);
  tone_ms(1175, 180);
  delay(80);
  tone_ms(1319, 220);
}

/**
 * Longer repeating alarm — stand-in for "Don't throw / illegal dumping".
 * Distinct from the test pattern so you can tell them apart by ear.
 */
void speaker_play_alarm() {
  for (int i = 0; i < 4; i++) {
    tone_ms(1500, 180);
    delay(70);
    tone_ms(900, 180);
    delay(70);
  }
  delay(120);
  tone_ms(2000, 350);
  delay(80);
  tone_ms(2000, 350);
}
