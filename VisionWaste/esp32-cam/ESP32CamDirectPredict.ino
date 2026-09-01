/*
 * VisionWaste ESP32-CAM — direct Railway /predict + DFPlayer command poll.
 *
 * Main loop: PIR, Wi-Fi recovery, GET /devices/commands every 2s.
 * Background task: POST /predict (does not block command polling).
 *
 * HTTP concurrency: separate WiFiClientSecure + HTTPClient per request
 * (upload task vs command poll vs ACK). No global mutex on long /predict.
 *
 * Audio: backend queues PLAY_AUDIO; ESP32 polls commands (not /predict JSON).
 */

#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"

// =====================================================
// WIFI — set your network credentials
// =====================================================

const char* WIFI_SSID = "Charukas_galaxy";
const char* WIFI_PASSWORD = "11111111";

// =====================================================
// BACKEND
// =====================================================

const char* BACKEND_BASE =
  "https://r26-it-084-production-3f77.up.railway.app";

const char* PREDICT_URL =
  "https://r26-it-084-production-3f77.up.railway.app/predict";

const char* COMMAND_URL =
  "https://r26-it-084-production-3f77.up.railway.app/devices/commands";

// =====================================================
// DEVICE
// =====================================================

const char* ESP32_ID = "esp-cam-1";

// =====================================================
// PIR SENSOR
// =====================================================

#define PIR_PIN 14

const unsigned long PIR_WARMUP_TIME = 60000;
const unsigned long PIR_CAPTURE_INTERVAL = 30000;
const unsigned long PIR_REARM_LOW_TIME = 1000;
const unsigned long PIR_HIGH_DEBOUNCE_TIME = 150;

volatile bool pirInterruptFlag = false;

unsigned long pirStartupTime = 0;
unsigned long lastMotionCapture = 0;
unsigned long pirLowSince = 0;
unsigned long pirHighSince = 0;

bool pirReady = false;
bool pirArmed = false;
bool motionActive = false;
bool captureInProgress = false;

// =====================================================
// BACKEND COMMAND POLLING
// =====================================================

const unsigned long COMMAND_INTERVAL = 2000;
const int COMMAND_ACK_RETRIES = 3;
unsigned long lastCommandCheck = 0;
// Same PLAY_AUDIO is re-delivered until ACK; skip replay for this id.
String activeAudioCommandId = "";

// =====================================================
// UPLOAD WORKER (FreeRTOS)
// =====================================================

const unsigned long PREDICT_HTTP_TIMEOUT_MS = 120000;
const unsigned long COMMAND_HTTP_TIMEOUT_MS = 10000;
const UBaseType_t UPLOAD_TASK_STACK = 16384;

struct UploadJob {
  uint8_t* data;
  size_t len;
};

QueueHandle_t uploadQueue = nullptr;
TaskHandle_t uploadTaskHandle = nullptr;

volatile bool uploadWorkerBusy = false;
volatile bool pendingCapture = false;
volatile bool schedulePendingCapture = false;

// =====================================================
// DFPLAYER
// =====================================================

#define MP3_TX_PIN 13
#define MP3_VOLUME 30
#define STARTUP_AUDIO true

HardwareSerial MP3Serial(1);

// =====================================================
// AI THINKER ESP32-CAM PINS
// =====================================================

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

// =====================================================
// FORWARD DECLARATIONS
// =====================================================

bool connectWiFi();
bool enqueueCapture(const char* reason);
void performPredictUpload(uint8_t* jpegData, size_t jpegLen);
void uploadWorkerTask(void* param);
void checkForCommand();
bool acknowledgeCommand(const String& commandId, const String& status,
                        const String& errorMessage = "");

// =====================================================
// CAMERA
// =====================================================

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
  config.frame_size = FRAMESIZE_UXGA;
  config.jpeg_quality = 8;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

  if (psramFound()) {
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.fb_count = 1;
  } else {
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera initialization failed: 0x%X\n", err);
    return false;
  }

  sensor_t* sensor = esp_camera_sensor_get();
  if (sensor) {
    sensor->set_framesize(sensor, FRAMESIZE_UXGA);
  }

  Serial.println("Camera OK");
  return true;
}

// =====================================================
// WIFI
// =====================================================

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

// =====================================================
// DFPLAYER
// =====================================================

void sendMP3Command(uint8_t command, uint16_t parameter)
{
  uint8_t packet[10];
  packet[0] = 0x7E;
  packet[1] = 0xFF;
  packet[2] = 0x06;
  packet[3] = command;
  packet[4] = 0x00;
  packet[5] = (parameter >> 8) & 0xFF;
  packet[6] = parameter & 0xFF;
  uint16_t sum = packet[1] + packet[2] + packet[3] + packet[4] + packet[5] + packet[6];
  uint16_t checksum = 0 - sum;
  packet[7] = (checksum >> 8) & 0xFF;
  packet[8] = checksum & 0xFF;
  packet[9] = 0xEF;
  MP3Serial.write(packet, sizeof(packet));
  MP3Serial.flush();
  delay(100);
}

void resetMP3()
{
  Serial.println("Resetting DFPlayer...");
  sendMP3Command(0x0C, 0);
  delay(1500);
  Serial.println("DFPlayer reset complete.");
}

void setMP3Volume(uint8_t volume)
{
  if (volume > 30) volume = 30;
  Serial.printf("DFPlayer volume: %u\n", volume);
  sendMP3Command(0x06, volume);
}

bool playMP3(uint16_t track)
{
  if (track == 0) {
    Serial.println("ERROR: Invalid DFPlayer track 0.");
    return false;
  }
  Serial.printf("[DFPLAYER] PLAY 000%u.mp3 (track %u)\n", track, track);
  sendMP3Command(0x03, track);
  return true;
}

bool stopMP3()
{
  Serial.println("DFPLAYER STOP");
  sendMP3Command(0x16, 0);
  delay(150);
  return true;
}

bool playAudioCommand(uint16_t track)
{
  if (track == 0) return false;
  Serial.printf("PLAY_AUDIO received. Backend track = %u\n", track);
  return playMP3(track);
}

void playStartupAudio()
{
  if (!STARTUP_AUDIO) return;
  Serial.println("STARTUP AUDIO — playing 0001.mp3");
  playMP3(1);
}

// =====================================================
// JSON HELPERS
// =====================================================

String getJsonString(const String& json, const String& key)
{
  String search = "\"" + key + "\"";
  int keyPosition = json.indexOf(search);
  if (keyPosition < 0) return "";
  int colonPosition = json.indexOf(':', keyPosition);
  if (colonPosition < 0) return "";
  int quoteStart = json.indexOf('"', colonPosition + 1);
  if (quoteStart < 0) return "";
  int quoteEnd = json.indexOf('"', quoteStart + 1);
  if (quoteEnd < 0) return "";
  return json.substring(quoteStart + 1, quoteEnd);
}

int getJsonInt(const String& json, const String& key)
{
  String search = "\"" + key + "\"";
  int keyPosition = json.indexOf(search);
  if (keyPosition < 0) return -1;
  int colonPosition = json.indexOf(':', keyPosition);
  if (colonPosition < 0) return -1;
  int start = colonPosition + 1;
  while (start < (int)json.length() &&
         (json[start] == ' ' || json[start] == '\t' ||
          json[start] == '\r' || json[start] == '\n')) {
    start++;
  }
  if (start >= (int)json.length()) return -1;
  if (json[start] == 'n') return -1;
  int end = start;
  while (end < (int)json.length() && json[end] >= '0' && json[end] <= '9') {
    end++;
  }
  if (end == start) return -1;
  return json.substring(start, end).toInt();
}

// =====================================================
// COMMAND ACK (dedicated HTTPS client — independent of /predict)
// =====================================================

bool acknowledgeCommand(const String& commandId, const String& status,
                        const String& errorMessage)
{
  if (commandId.length() == 0 || WiFi.status() != WL_CONNECTED) {
    return false;
  }

  bool ok = false;
  String ackURL = String(BACKEND_BASE) + "/devices/commands/" + commandId + "/ack";
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (http.begin(client, ackURL)) {
    http.setTimeout(COMMAND_HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");
    String json = "{\"esp32_id\":\"" + String(ESP32_ID) + "\",\"status\":\"" + status + "\"";
    if (errorMessage.length() > 0) {
      json += ",\"error_message\":\"" + errorMessage + "\"";
    }
    json += "}";
    unsigned long t0 = millis();
    int code = http.POST(json);
    Serial.printf("[COMMAND] ACK %s HTTP %d (%lu ms)\n",
                  status.c_str(), code, millis() - t0);
    ok = (code >= 200 && code < 300);
    if (ok) {
      Serial.println("[COMMAND] ACK completed");
    } else if (code > 0) {
      Serial.println(http.getString());
    } else {
      Serial.println(http.errorToString(code));
    }
    http.end();
  } else {
    Serial.println("[COMMAND] ACK HTTP begin failed");
  }

  return ok;
}

bool acknowledgeCommandWithRetry(const String& commandId, const String& status,
                                 const String& errorMessage)
{
  for (int attempt = 1; attempt <= COMMAND_ACK_RETRIES; attempt++) {
    if (acknowledgeCommand(commandId, status, errorMessage)) {
      return true;
    }
    if (attempt < COMMAND_ACK_RETRIES) {
      Serial.printf("[COMMAND] ACK retry %d/%d\n", attempt + 1, COMMAND_ACK_RETRIES);
      delay(250);
    }
  }
  Serial.println("[COMMAND] ACK failed after retries — will not replay audio");
  return false;
}

// =====================================================
// COMMAND POLL (dedicated HTTPS client — never blocked by /predict)
// =====================================================

void checkForCommand()
{
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.println("[COMMAND] polling...");

  String url = String(COMMAND_URL) + "?esp32_id=" + String(ESP32_ID);
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (!http.begin(client, url)) {
    Serial.println("[COMMAND] HTTP begin failed");
    return;
  }

  http.setTimeout(COMMAND_HTTP_TIMEOUT_MS);
  http.addHeader("Accept", "application/json");
  unsigned long t0 = millis();
  int code = http.GET();

  if (code >= 200 && code < 300) {
    String response = http.getString();
    http.end();
    Serial.printf("[COMMAND] poll OK (%lu ms)\n", millis() - t0);

    if (response.indexOf("\"command\":null") >= 0) {
      return;
    }

    String commandId = getJsonString(response, "command_id");
    String command = getJsonString(response, "command");
    int track = getJsonInt(response, "track");

    Serial.printf("[COMMAND] received id=%s cmd=%s track=%d\n",
                  commandId.c_str(), command.c_str(), track);

    if (command == "PLAY_AUDIO") {
      if (commandId.length() == 0 || track <= 0) {
        if (commandId.length() > 0) {
          acknowledgeCommandWithRetry(commandId, "failed", "Invalid audio track");
        }
        return;
      }

      bool played = false;
      if (commandId == activeAudioCommandId) {
        Serial.println("[COMMAND] duplicate PLAY_AUDIO — ACK retry only (no replay)");
        played = true;
      } else {
        Serial.printf("[COMMAND] PLAY_AUDIO track=%d id=%s\n",
                      track, commandId.c_str());
        played = playAudioCommand((uint16_t)track);
        if (played) {
          activeAudioCommandId = commandId;
        }
      }

      const char* ackStatus = played ? "completed" : "failed";
      const char* ackError = played ? "" : "DFPlayer play failed";
      if (acknowledgeCommandWithRetry(commandId, ackStatus, ackError)) {
        activeAudioCommandId = "";
      }
    } else if (command == "STOP_AUDIO") {
      if (commandId.length() == 0) return;
      Serial.println("[COMMAND] STOP_AUDIO");
      activeAudioCommandId = "";
      bool stopped = stopMP3();
      acknowledgeCommandWithRetry(commandId, stopped ? "completed" : "failed",
                                  stopped ? "" : "DFPlayer stop failed");
    } else if (command.length() > 0 && commandId.length() > 0) {
      acknowledgeCommandWithRetry(commandId, "failed", "Unknown command");
    }
    return;
  }

  Serial.printf("[COMMAND] poll HTTP %d (%lu ms)\n", code, millis() - t0);
  if (code > 0) {
    Serial.println(http.getString());
  } else {
    Serial.println(http.errorToString(code));
  }
  http.end();
}

// =====================================================
// PREDICT UPLOAD (background task — own HTTPS client, no command mutex)
// =====================================================

void performPredictUpload(uint8_t* jpegData, size_t jpegLen)
{
  if (!jpegData || jpegLen < 4) {
    if (jpegData) free(jpegData);
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[UPLOAD] skipped — Wi-Fi unavailable");
    free(jpegData);
    return;
  }

  Serial.println("[UPLOAD] START");
  Serial.println("[UPLOAD] POST /predict");

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (!http.begin(client, PREDICT_URL)) {
    Serial.println("[UPLOAD] HTTP begin FAILED");
    free(jpegData);
    return;
  }

  http.setTimeout(PREDICT_HTTP_TIMEOUT_MS);

  String boundary = "----ESP32CAMBoundary7A91";
  String bodyStart =
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"source_type\"\r\n\r\n"
    "esp32\r\n"
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"esp32_id\"\r\n\r\n" +
    String(ESP32_ID) + "\r\n"
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\n"
    "Content-Type: image/jpeg\r\n\r\n";

  String bodyEnd = "\r\n--" + boundary + "--\r\n";
  size_t totalLength = bodyStart.length() + jpegLen + bodyEnd.length();

  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  http.addHeader("Accept", "application/json");

  Serial.printf("[UPLOAD] JPEG %u bytes, multipart %u bytes, free PSRAM %u\n",
                (unsigned)jpegLen, (unsigned)totalLength,
                (unsigned)ESP.getFreePsram());

  uint8_t* requestBuffer = nullptr;
  if (psramFound()) {
    requestBuffer = (uint8_t*)ps_malloc(totalLength);
  }
  if (requestBuffer == nullptr) {
    requestBuffer = (uint8_t*)malloc(totalLength);
  }

  if (requestBuffer == nullptr) {
    Serial.println("[UPLOAD] ERROR: multipart buffer alloc failed");
    http.end();
    free(jpegData);
    return;
  }

  size_t position = 0;
  memcpy(requestBuffer + position, bodyStart.c_str(), bodyStart.length());
  position += bodyStart.length();
  memcpy(requestBuffer + position, jpegData, jpegLen);
  position += jpegLen;
  memcpy(requestBuffer + position, bodyEnd.c_str(), bodyEnd.length());

  free(jpegData);
  jpegData = nullptr;

  unsigned long requestStart = millis();
  int httpCode = http.POST(requestBuffer, totalLength);
  free(requestBuffer);
  requestBuffer = nullptr;

  unsigned long requestTime = millis() - requestStart;
  Serial.printf("[UPLOAD] Prediction HTTP status: %d (%lu ms)\n",
                httpCode, requestTime);

  if (httpCode > 0) {
    String response = http.getString();
    if (response.length() > 200) {
      response = response.substring(0, 200) + "...";
    }
    if (httpCode >= 200 && httpCode < 300) {
      Serial.println("[UPLOAD] OK — backend accepted image");
    } else {
      Serial.printf("[UPLOAD] backend error: %s\n", response.c_str());
    }
  } else {
    Serial.printf("[UPLOAD] failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  Serial.println("[UPLOAD] END");
}

// =====================================================
// UPLOAD WORKER TASK
// =====================================================

void uploadWorkerTask(void* param)
{
  (void)param;
  UploadJob job;

  for (;;) {
    if (xQueueReceive(uploadQueue, &job, portMAX_DELAY) == pdTRUE) {
      Serial.println("[UPLOAD] worker: job received");
      performPredictUpload(job.data, job.len);

      uploadWorkerBusy = false;

      if (pendingCapture) {
        pendingCapture = false;
        schedulePendingCapture = true;
        Serial.println("[UPLOAD] pending capture scheduled for main loop");
      }
    }
  }
}

// =====================================================
// ENQUEUE CAPTURE (main loop only — camera owner)
// =====================================================

bool enqueueCapture(const char* reason)
{
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Capture skipped: Wi-Fi unavailable.");
    return false;
  }

  if (uploadWorkerBusy) {
    pendingCapture = true;
    Serial.printf("Capture deferred (upload busy): %s\n", reason);
    return false;
  }

  if (captureInProgress) {
    pendingCapture = true;
    Serial.printf("Capture deferred (copy in progress): %s\n", reason);
    return false;
  }

  captureInProgress = true;

  Serial.printf("[PIR] enqueue capture: %s\n", reason);

  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[CAMERA] capture FAILED");
    captureInProgress = false;
    return false;
  }

  if (fb->len < 4 || fb->buf[0] != 0xFF || fb->buf[1] != 0xD8 ||
      fb->buf[fb->len - 2] != 0xFF || fb->buf[fb->len - 1] != 0xD9) {
    Serial.println("[CAMERA] invalid JPEG");
    esp_camera_fb_return(fb);
    captureInProgress = false;
    return false;
  }

  Serial.printf("[CAMERA] captured %ux%u %u bytes\n",
                fb->width, fb->height, (unsigned)fb->len);

  uint8_t* copy = nullptr;
  if (psramFound()) {
    copy = (uint8_t*)ps_malloc(fb->len);
  }
  if (copy == nullptr) {
    copy = (uint8_t*)malloc(fb->len);
  }

  if (copy == nullptr) {
    Serial.println("ERROR: Cannot allocate JPEG copy.");
    esp_camera_fb_return(fb);
    captureInProgress = false;
    return false;
  }

  memcpy(copy, fb->buf, fb->len);
  size_t len = fb->len;
  esp_camera_fb_return(fb);
  fb = nullptr;
  captureInProgress = false;

  UploadJob job = { copy, len };
  uploadWorkerBusy = true;

  if (uploadQueue == nullptr ||
      xQueueSend(uploadQueue, &job, 0) != pdTRUE) {
    Serial.println("Upload queue full — scheduling pending capture.");
    free(copy);
    uploadWorkerBusy = false;
    pendingCapture = true;
    return false;
  }

  Serial.println("[UPLOAD] queued");
  return true;
}

// =====================================================
// PIR
// =====================================================

void IRAM_ATTR pirISR()
{
  pirInterruptFlag = true;
}

void startPIR()
{
  Serial.println("Starting PIR sensor...");
  pinMode(PIR_PIN, INPUT_PULLDOWN);
  pirStartupTime = millis();
  pirReady = false;
  pirArmed = false;
  motionActive = false;
  captureInProgress = false;
  lastMotionCapture = 0;
  pirLowSince = 0;
  pirHighSince = 0;
  pirInterruptFlag = false;
  attachInterrupt(digitalPinToInterrupt(PIR_PIN), pirISR, CHANGE);
  Serial.printf("PIR GPIO: %d — warm-up 60 seconds\n", PIR_PIN);
}

void checkMotion()
{
  const unsigned long now = millis();
  const bool pirHigh = (digitalRead(PIR_PIN) == HIGH);

  if (pirInterruptFlag) {
    pirInterruptFlag = false;
    Serial.printf("[PIR] transition, state=%s\n", pirHigh ? "HIGH" : "LOW");
  }

  if (!pirReady) {
    if (now - pirStartupTime < PIR_WARMUP_TIME) return;
    pirInterruptFlag = false;
    pirReady = true;
    pirArmed = true;
    motionActive = false;
    pirLowSince = pirHigh ? 0 : now;
    pirHighSince = pirHigh ? now : 0;
    Serial.println("PIR WARM-UP FINISHED — ready");
    return;
  }

  if (!pirHigh) {
    pirHighSince = 0;
    if (pirLowSince == 0) pirLowSince = now;
    if (now - pirLowSince >= PIR_REARM_LOW_TIME) {
      if (motionActive) Serial.println("PIR LOW — MOTION EVENT ENDED");
      motionActive = false;
      pirArmed = true;
    }
    return;
  }

  pirLowSince = 0;
  if (pirHighSince == 0) pirHighSince = now;
  if (now - pirHighSince < PIR_HIGH_DEBOUNCE_TIME) return;

  if (pirArmed && !motionActive) {
    pirArmed = false;
    motionActive = true;
    lastMotionCapture = now;
    Serial.println("[PIR] MOTION DETECTED — first capture");
    enqueueCapture("first motion");
    return;
  }

  if (motionActive && now - lastMotionCapture >= PIR_CAPTURE_INTERVAL) {
    lastMotionCapture = now;
    Serial.println("[PIR] 30s continuing motion capture");
    enqueueCapture("continuing motion");
  }
}

void processScheduledCapture()
{
  if (!schedulePendingCapture) return;
  schedulePendingCapture = false;
  enqueueCapture("pending follow-up");
}

// =====================================================
// SETUP
// =====================================================

void setup()
{
  Serial.begin(115200);
  delay(1500);

  Serial.println("======================================");
  Serial.println("  ESP32-CAM SMART CAMERA (non-blocking)");
  Serial.println("  PIR + Railway /predict + DFPlayer");
  Serial.println("======================================");
  Serial.printf("Device ID: %s\n", ESP32_ID);

  uploadQueue = xQueueCreate(1, sizeof(UploadJob));

  xTaskCreatePinnedToCore(
    uploadWorkerTask,
    "vw_upload",
    UPLOAD_TASK_STACK,
    nullptr,
    1,
    &uploadTaskHandle,
    1
  );

  startPIR();

  Serial.println("Starting DFPlayer UART (GPIO13 -> DFPlayer RX)...");
  MP3Serial.begin(9600, SERIAL_8N1, -1, MP3_TX_PIN);
  delay(1000);
  resetMP3();
  setMP3Volume(MP3_VOLUME);
  playStartupAudio();

  if (!connectWiFi()) {
    Serial.println("WARNING: Wi-Fi unavailable — will retry in loop.");
  }

  if (!startCamera()) {
    Serial.println("ERROR: Camera initialization failed.");
    return;
  }

  delay(1000);
  pirStartupTime = millis();
  pirReady = false;
  pirArmed = false;
  motionActive = false;
  captureInProgress = false;
  pirLowSince = 0;
  pirHighSince = 0;
  pirInterruptFlag = false;

  Serial.println("SYSTEM INITIALIZED");
  Serial.println("Command poll: every 2s (independent HTTPS from /predict)");
  Serial.println("Predict upload: background task, 120s timeout, no command mutex");
  lastCommandCheck = millis();
}

// =====================================================
// LOOP
// =====================================================

void loop()
{
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWiFiRetry = 0;
    if (millis() - lastWiFiRetry >= 10000) {
      lastWiFiRetry = millis();
      if (uploadWorkerBusy) {
        Serial.println("[WIFI] reconnect deferred — upload in progress");
      } else {
        Serial.println("[WIFI] disconnected — reconnecting...");
        connectWiFi();
      }
    }
  }

  checkMotion();
  processScheduledCapture();

  if (WiFi.status() == WL_CONNECTED && millis() - lastCommandCheck >= COMMAND_INTERVAL) {
    lastCommandCheck = millis();
    checkForCommand();
  }

  static unsigned long lastPIRDiagnostic = 0;
  if (millis() - lastPIRDiagnostic >= 5000) {
    lastPIRDiagnostic = millis();
    Serial.printf("[PIR] GPIO=%s ready=%s armed=%s motion=%s capture=%s upload=%s pending=%s\n",
                  digitalRead(PIR_PIN) ? "HIGH" : "LOW",
                  pirReady ? "YES" : "NO",
                  pirArmed ? "YES" : "NO",
                  motionActive ? "YES" : "NO",
                  captureInProgress ? "YES" : "NO",
                  uploadWorkerBusy ? "YES" : "NO",
                  pendingCapture ? "YES" : "NO");
  }

  delay(10);
}
