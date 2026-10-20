/*
 * =============================================================================
 *  VisionWaste — ESP32-CAM  (photo board only)
 * =============================================================================
 *
 * ROLE IN THE SYSTEM
 *   This board is the "eyes" of a smart bin. It watches a PIR motion sensor,
 *   takes JPEG photos during a motion session, and uploads them to Railway
 *   POST /predict. It does NOT play sound. Voice is handled by a second board:
 *     VisionWaste/esp32-voice/ESP32VoicePlayer.ino  (esp-voice-1 + DFPlayer)
 *
 *   Backend links them via Device.audio_esp32_id (camera esp32_id → voice id).
 *
 * MOTION-SESSION TIMELINE
 *   1) Boot → ST_WARMUP (~60s) so the PIR settles (avoids false triggers).
 *   2) ST_IDLE — waiting for PIR LOW→HIGH.
 *   3) Rising edge → ST_SESSION, new motion_session_id.
 *   4) First photo ~3s later IF PIR is still HIGH (person still present).
 *   5) While PIR stays HIGH → one photo every ~10s (same session id).
 *   6) PIR HIGH→LOW → session ends; no more scheduled shots.
 *
 * WHY A FREE-RTOS UPLOAD WORKER?
 *   HTTP to Railway can take seconds. PIR must keep being sampled during upload,
 *   so capture JPEG is copied to RAM/PSRAM and handed to a queue; a second core
 *   task performs the multipart POST. Loop() only runs checkMotion().
 *
 * MULTIPART FIELDS SENT TO /predict
 *   source_type=esp32, esp32_id, motion_session_id, event_id, image=JPEG
 *   Backend replies quickly {accepted, analyzing:true} then runs models + voice.
 *
 * BOARD / PIN NOTES
 *   AI-Thinker ESP32-CAM pin map below (OV2640). PIR signal → GPIO14.
 * =============================================================================
 */

#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"

/* -----------------------------------------------------------------------------
 * Network / identity — must match a Device row on the backend (esp32_id).
 * Prefer moving secrets to secrets.h (like the voice board) before sharing.
 * --------------------------------------------------------------------------- */
const char* WIFI_SSID = "Charukas_galaxy";
const char* WIFI_PASSWORD = "11111111";
const char* BACKEND_BASE = "https://r26-it-084-production-2220.up.railway.app";
const char* DEVICE_API_KEY = "";   // Optional; set if backend requires X-Device-Key
const char* ESP32_ID = "espcam 1"; // Must match Device.esp32_id in the dashboard

/* PIR motion input (digital HIGH = motion). */
#define PIR_PIN 14

/* Timing knobs (milliseconds). Adjust for demo vs production. */
const unsigned long PIR_WARMUP_TIME_MS = 60000;        // Ignore PIR after boot
const unsigned long FIRST_CAPTURE_DELAY_MS = 3000;     // Debounce before first shot
const unsigned long REPEAT_CAPTURE_INTERVAL_MS = 10000; // Spacing while session active
const unsigned long HTTP_TIMEOUT_MS = 120000;          // Long: Railway + cold starts
const int MAX_UPLOAD_RETRIES = 2;
const UBaseType_t UPLOAD_TASK_STACK = 16384;           // HTTPS needs a large stack

/* Finite-state machine for motion. */
enum MotionState {
  ST_WARMUP,  // PIR stabilizing after power-on
  ST_IDLE,    // Armed; waiting for rising edge
  ST_SESSION  // Motion active; capturing on a schedule
};

MotionState motionState = ST_WARMUP;
unsigned long warmupStartedAt = 0;
unsigned long sessionStartedAt = 0;
unsigned long nextCaptureAt = 0;       // Absolute millis() when next shot is due
unsigned long lastCaptureStartAt = 0;
uint32_t sessionSeq = 0;               // Monotonic counter → motion_session_id
uint16_t sessionShotIndex = 0;         // 1-based shot index within the session
uint32_t currentSessionId = 0;
bool lastPirHigh = false;              // Edge detection vs previous sample
bool captureInProgress = false;        // Camera grab in progress on this core
uint16_t missedDeadlines = 0;          // Stats when camera/upload was busy

/**
 * One JPEG upload job. Ownership of `data`:
 *   - Allocated by enqueueSessionCapture (ps_malloc/malloc)
 *   - Freed by performPredictUpload after success or final failure
 */
struct UploadJob {
  uint8_t* data;
  size_t len;
  uint32_t sessionId;
  uint32_t eventId;
  unsigned long captureStartMs;
};

QueueHandle_t uploadQueue = nullptr;
TaskHandle_t uploadTaskHandle = nullptr;
volatile bool uploadWorkerBusy = false; // True while a job is queued or uploading

/* AI-Thinker ESP32-CAM (OV2640) SCCB / parallel camera pins — do not remount casually. */
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

/** Millis wrap-safe: true when `now` has reached or passed `due`. */
bool timeReached(unsigned long now, unsigned long due)
{
  return (long)(now - due) >= 0;
}

/**
 * Initialize OV2640 JPEG capture.
 * Prefers PSRAM double-buffer + GRAB_LATEST so we always get a fresh frame
 * when motion fires (stale buffered frames would confuse ML).
 */
bool startCamera()
{
  Serial.println();
  Serial.println("Starting camera...");

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_SVGA;   // Balance quality vs upload size / RAM
  config.jpeg_quality = 12;            // Lower number = higher quality
  config.grab_mode = CAMERA_GRAB_LATEST;

  if (psramFound()) {
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.fb_count = 2;
  } else {
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.fb_count = 1;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera initialization failed: 0x%X\n", err);
    return false;
  }

  sensor_t* sensor = esp_camera_sensor_get();
  if (sensor) {
    sensor->set_framesize(sensor, FRAMESIZE_SVGA);
  }

  Serial.println("Camera OK");
  return true;
}

/** Station mode Wi-Fi; sleep disabled for more reliable HTTPS. */
bool connectWiFi()
{
  Serial.println();
  Serial.println("Connecting Wi-Fi...");
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - startTime >= 30000) {
      Serial.println();
      Serial.println("Wi-Fi connection timeout.");
      return false;
    }
  }

  Serial.println();
  Serial.println("Wi-Fi connected.");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

/**
 * Build multipart/form-data and POST to BACKEND_BASE/predict.
 * Uses TLS with setInsecure() (typical for hobby/Railway demos; pin certs for prod).
 * On success frees jpeg buffer and returns; on failure retries then frees.
 */
void performPredictUpload(const UploadJob& job)
{
  if (!job.data || job.len < 4) {
    if (job.data) free(job.data);
    return;
  }

  uint8_t* jpegData = job.data;
  size_t jpegLen = job.len;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("[UPLOAD] FAIL event=%lu session=%lu — Wi-Fi unavailable\n",
                  (unsigned long)job.eventId, (unsigned long)job.sessionId);
    free(jpegData);
    return;
  }

  String sessionStr = String(job.sessionId);
  String eventStr = String(job.eventId);

  for (int attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    Serial.printf("[UPLOAD] START event=%s session=%s attempt=%d/%d\n",
                  eventStr.c_str(), sessionStr.c_str(), attempt, MAX_UPLOAD_RETRIES);

    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    String predictUrl = String(BACKEND_BASE) + "/predict";
    if (!http.begin(client, predictUrl)) {
      Serial.println("[UPLOAD] HTTP begin FAILED");
      http.end();
      continue;
    }

    http.setTimeout(HTTP_TIMEOUT_MS);

    /* Multipart body: metadata fields first, then raw JPEG bytes, then closing boundary. */
    String boundary = "----ESP32CAMBoundary7A91";
    String bodyStart =
      "--" + boundary + "\r\n"
      "Content-Disposition: form-data; name=\"source_type\"\r\n\r\n"
      "esp32\r\n"
      "--" + boundary + "\r\n"
      "Content-Disposition: form-data; name=\"esp32_id\"\r\n\r\n" +
      String(ESP32_ID) + "\r\n"
      "--" + boundary + "\r\n"
      "Content-Disposition: form-data; name=\"motion_session_id\"\r\n\r\n" +
      sessionStr + "\r\n"
      "--" + boundary + "\r\n"
      "Content-Disposition: form-data; name=\"event_id\"\r\n\r\n" +
      eventStr + "\r\n"
      "--" + boundary + "\r\n"
      "Content-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\n"
      "Content-Type: image/jpeg\r\n\r\n";
    String bodyEnd = "\r\n--" + boundary + "--\r\n";
    size_t totalLength = bodyStart.length() + jpegLen + bodyEnd.length();

    http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
    http.addHeader("Accept", "application/json");
    if (strlen(DEVICE_API_KEY) > 0) {
      http.addHeader("X-Device-Key", DEVICE_API_KEY);
    }

    uint8_t* requestBuffer = psramFound() ? (uint8_t*)ps_malloc(totalLength) : nullptr;
    if (requestBuffer == nullptr) requestBuffer = (uint8_t*)malloc(totalLength);
    if (requestBuffer == nullptr) {
      Serial.println("[UPLOAD] ERROR: multipart buffer alloc failed");
      http.end();
      continue;
    }

    size_t position = 0;
    memcpy(requestBuffer + position, bodyStart.c_str(), bodyStart.length());
    position += bodyStart.length();
    memcpy(requestBuffer + position, jpegData, jpegLen);
    position += jpegLen;
    memcpy(requestBuffer + position, bodyEnd.c_str(), bodyEnd.length());

    unsigned long requestStart = millis();
    int httpCode = http.POST(requestBuffer, totalLength);
    free(requestBuffer);
    unsigned long uploadMs = millis() - requestStart;

    if (httpCode >= 200 && httpCode < 300) {
      Serial.printf("[UPLOAD] OK event=%s session=%s http=%d upload_ms=%lu capture_to_upload_ms=%lu\n",
                    eventStr.c_str(), sessionStr.c_str(), httpCode, uploadMs,
                    millis() - job.captureStartMs);
      http.end();
      free(jpegData);
      return;
    }

    Serial.printf("[UPLOAD] FAIL event=%s http=%d upload_ms=%lu\n",
                  eventStr.c_str(), httpCode, uploadMs);
    if (httpCode > 0) Serial.println(http.getString());
    else Serial.println(http.errorToString(httpCode));
    http.end();
  }

  Serial.printf("[UPLOAD] ABORT event=%lu after %d attempts\n",
                (unsigned long)job.eventId, MAX_UPLOAD_RETRIES);
  free(jpegData);
}

/** FreeRTOS worker: blocks on queue, uploads one job at a time, clears busy flag. */
void uploadWorkerTask(void* param)
{
  (void)param;
  UploadJob job;
  for (;;) {
    if (xQueueReceive(uploadQueue, &job, portMAX_DELAY) == pdTRUE) {
      performPredictUpload(job);
      uploadWorkerBusy = false;
    }
  }
}

/**
 * Grab one JPEG, validate SOI/EOI markers, copy off the camera frame buffer,
 * and enqueue for background upload. Returns false if Wi-Fi/camera/queue busy.
 *
 * event_id encoding: sessionId * 100 + shotIndex (unique within a short window).
 */
bool enqueueSessionCapture(const char* reason)
{
  const unsigned long captureStart = millis();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("[CAPTURE] skipped (%s) — Wi-Fi unavailable\n", reason);
    return false;
  }
  if (uploadWorkerBusy || captureInProgress) {
    Serial.printf("[CAPTURE] missed deadline (%s) — camera/upload busy\n", reason);
    missedDeadlines++;
    return false;
  }

  captureInProgress = true;
  sessionShotIndex++;
  uint32_t eventId = currentSessionId * 100 + sessionShotIndex;

  Serial.printf("[CAPTURE] start reason=%s session=%lu event=%lu shot=%u motion_to_capture_ms=%lu\n",
                reason,
                (unsigned long)currentSessionId,
                (unsigned long)eventId,
                sessionShotIndex,
                captureStart - sessionStartedAt);

  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[CAMERA] capture FAILED");
    captureInProgress = false;
    sessionShotIndex--;
    return false;
  }

  /* Basic JPEG sanity: starts with FF D8, ends with FF D9. */
  if (fb->len < 4 || fb->buf[0] != 0xFF || fb->buf[1] != 0xD8 ||
      fb->buf[fb->len - 2] != 0xFF || fb->buf[fb->len - 1] != 0xD9) {
    Serial.println("[CAMERA] invalid JPEG");
    esp_camera_fb_return(fb);
    captureInProgress = false;
    sessionShotIndex--;
    return false;
  }

  Serial.printf("[CAMERA] done %ux%u %u bytes capture_ms=%lu\n",
                fb->width, fb->height, (unsigned)fb->len, millis() - captureStart);

  uint8_t* copy = psramFound() ? (uint8_t*)ps_malloc(fb->len) : nullptr;
  if (copy == nullptr) copy = (uint8_t*)malloc(fb->len);
  if (copy == nullptr) {
    Serial.println("[CAMERA] JPEG copy alloc failed");
    esp_camera_fb_return(fb);
    captureInProgress = false;
    sessionShotIndex--;
    return false;
  }

  memcpy(copy, fb->buf, fb->len);
  size_t len = fb->len;
  esp_camera_fb_return(fb);  // Return DMA buffer ASAP so the sensor can continue
  captureInProgress = false;

  UploadJob job;
  job.data = copy;
  job.len = len;
  job.sessionId = currentSessionId;
  job.eventId = eventId;
  job.captureStartMs = captureStart;

  uploadWorkerBusy = true;
  if (uploadQueue == nullptr || xQueueSend(uploadQueue, &job, 0) != pdTRUE) {
    free(copy);
    uploadWorkerBusy = false;
    Serial.println("[UPLOAD] queue full — drop event");
    return false;
  }

  lastCaptureStartAt = captureStart;
  Serial.printf("[UPLOAD] queued event=%lu session=%lu\n",
                (unsigned long)eventId, (unsigned long)currentSessionId);
  return true;
}

/** PIR rising edge: open a new motion session and schedule the first photo. */
void beginSession(unsigned long now)
{
  sessionSeq++;
  currentSessionId = sessionSeq;
  sessionStartedAt = now;
  sessionShotIndex = 0;
  nextCaptureAt = now + FIRST_CAPTURE_DELAY_MS;
  motionState = ST_SESSION;
  Serial.printf("[SESSION] START id=%lu first_capture_in=%lu ms\n",
                (unsigned long)currentSessionId, FIRST_CAPTURE_DELAY_MS);
}

/** PIR fallen (or cleared before shot): stop scheduling captures. */
void endSession(const char* why)
{
  if (motionState != ST_SESSION) return;
  Serial.printf("[SESSION] END id=%lu why=%s shots=%u missed=%u duration_ms=%lu\n",
                (unsigned long)currentSessionId,
                why,
                sessionShotIndex,
                missedDeadlines,
                millis() - sessionStartedAt);
  motionState = ST_IDLE;
  nextCaptureAt = 0;
}

/**
 * Sample PIR, drive the state machine, and fire captures on schedule.
 * Called frequently from loop(); keep this non-blocking (no HTTP here).
 */
void checkMotion()
{
  const unsigned long now = millis();
  const bool pirHigh = (digitalRead(PIR_PIN) == HIGH);
  const bool rising = pirHigh && !lastPirHigh;
  const bool falling = !pirHigh && lastPirHigh;
  lastPirHigh = pirHigh;

  if (rising) Serial.println("[PIR] LOW -> HIGH");
  if (falling) Serial.println("[PIR] HIGH -> LOW");

  /* --- Warm-up: discard early PIR chatter after power-on --- */
  if (motionState == ST_WARMUP) {
    if (!timeReached(now, warmupStartedAt + PIR_WARMUP_TIME_MS)) return;
    Serial.println("[PIR] warm-up done — waiting for motion");
    motionState = ST_IDLE;
    return;
  }

  /* --- End session as soon as motion clears --- */
  if (falling && motionState == ST_SESSION) {
    endSession("pir-low");
    return;
  }

  /* --- Idle → start session on rising edge --- */
  if (motionState == ST_IDLE) {
    if (rising) beginSession(now);
    return;
  }

  /* --- Session: wait until nextCaptureAt --- */
  if (!timeReached(now, nextCaptureAt)) return;

  if (!pirHigh) {
    endSession("pir-low-before-capture");
    return;
  }

  const bool first = (sessionShotIndex == 0);
  const bool ok = enqueueSessionCapture(first ? "first" : "repeat");
  if (ok) {
    /* Schedule relative to when this shot started (stable 10s cadence). */
    nextCaptureAt = lastCaptureStartAt + REPEAT_CAPTURE_INTERVAL_MS;
  } else {
    /* Camera/upload busy — try again after one interval. */
    nextCaptureAt = now + REPEAT_CAPTURE_INTERVAL_MS;
    Serial.printf("[CAPTURE] reschedule in %lu ms\n", REPEAT_CAPTURE_INTERVAL_MS);
  }
}

void setup()
{
  Serial.begin(115200);
  delay(1500);
  Serial.println("======================================");
  Serial.println("  ESP32-CAM  motion session capture");
  Serial.println("======================================");
  Serial.printf("Device ID: %s\n", ESP32_ID);
  Serial.printf("Timing: first=%lums repeat=%lums\n",
                FIRST_CAPTURE_DELAY_MS, REPEAT_CAPTURE_INTERVAL_MS);

  /* Depth-1 queue: at most one pending upload (drops rather than stacking voices/photos). */
  uploadQueue = xQueueCreate(1, sizeof(UploadJob));
  xTaskCreatePinnedToCore(
    uploadWorkerTask, "vw_upload", UPLOAD_TASK_STACK, nullptr, 1, &uploadTaskHandle, 1
  );

  pinMode(PIR_PIN, INPUT);
  lastPirHigh = digitalRead(PIR_PIN) == HIGH;
  warmupStartedAt = millis();
  motionState = ST_WARMUP;
  Serial.printf("PIR GPIO: %d — warm-up 60 seconds\n", PIR_PIN);

  if (!connectWiFi()) {
    Serial.println("WARNING: Wi-Fi unavailable — will retry in loop.");
  }

  if (!startCamera()) {
    Serial.println("ERROR: Camera initialization failed.");
    return;
  }

  /* Restart warm-up clock after camera init (sensor power can upset PIR). */
  delay(1000);
  warmupStartedAt = millis();
  motionState = ST_WARMUP;
  lastPirHigh = digitalRead(PIR_PIN) == HIGH;
  Serial.println("SYSTEM READY — voice board is esp-voice-1");
}

void loop()
{
  /* Background Wi-Fi reconnect; skip while an upload holds the radio busy. */
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWiFiRetry = 0;
    if (timeReached(millis(), lastWiFiRetry + 10000)) {
      lastWiFiRetry = millis();
      if (!uploadWorkerBusy) connectWiFi();
    }
  }

  checkMotion();

  /* Heartbeat every 5s — useful when Serial Monitor is open during viva demos. */
  static unsigned long lastDiag = 0;
  if (timeReached(millis(), lastDiag + 5000)) {
    lastDiag = millis();
    const char* name = motionState == ST_WARMUP ? "WARMUP"
                     : motionState == ST_IDLE ? "IDLE" : "SESSION";
    Serial.printf("[PIR] %s pin=%s session=%lu shots=%u upload_busy=%d\n",
                  name,
                  digitalRead(PIR_PIN) == HIGH ? "HIGH" : "LOW",
                  (unsigned long)currentSessionId,
                  sessionShotIndex,
                  uploadWorkerBusy ? 1 : 0);
  }

  delay(10);
}
