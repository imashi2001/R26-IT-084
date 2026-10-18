/*
 * VisionWaste ESP32-CAM — camera + PIR only.
 * Uploads JPEG to Railway POST /predict.
 * Audio lives on a separate board: VisionWaste/esp32-voice/ESP32VoicePlayer.ino
 */

#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"

const char* WIFI_SSID = "Charukas_galaxy";
const char* WIFI_PASSWORD = "11111111";

const char* PREDICT_URL =
  "https://r26-it-084-production-2220.up.railway.app/predict";

const char* ESP32_ID = "esp-cam-1";

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

const unsigned long PREDICT_HTTP_TIMEOUT_MS = 120000;
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

bool connectWiFi();
bool enqueueCapture(const char* reason);
void performPredictUpload(uint8_t* jpegData, size_t jpegLen);
void uploadWorkerTask(void* param);

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
  config.frame_size = FRAMESIZE_SVGA;
  config.jpeg_quality = 12;
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

  Serial.println("[UPLOAD] START POST /predict");

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

  Serial.printf("[UPLOAD] HTTP %d (%lu ms)\n", httpCode, millis() - requestStart);
  if (httpCode >= 200 && httpCode < 300) {
    Serial.println("[UPLOAD] OK — backend accepted image");
  } else if (httpCode > 0) {
    Serial.println(http.getString());
  } else {
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
  Serial.println("[UPLOAD] END");
}

void uploadWorkerTask(void* param)
{
  (void)param;
  UploadJob job;
  for (;;) {
    if (xQueueReceive(uploadQueue, &job, portMAX_DELAY) == pdTRUE) {
      performPredictUpload(job.data, job.len);
      uploadWorkerBusy = false;
      if (pendingCapture) {
        pendingCapture = false;
        schedulePendingCapture = true;
      }
    }
  }
}

bool enqueueCapture(const char* reason)
{
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Capture skipped: Wi-Fi unavailable.");
    return false;
  }

  if (uploadWorkerBusy || captureInProgress) {
    pendingCapture = true;
    Serial.printf("Capture deferred: %s\n", reason);
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

  uint8_t* copy = psramFound() ? (uint8_t*)ps_malloc(fb->len) : nullptr;
  if (copy == nullptr) copy = (uint8_t*)malloc(fb->len);
  if (copy == nullptr) {
    Serial.println("ERROR: Cannot allocate JPEG copy.");
    esp_camera_fb_return(fb);
    captureInProgress = false;
    return false;
  }

  memcpy(copy, fb->buf, fb->len);
  size_t len = fb->len;
  esp_camera_fb_return(fb);
  captureInProgress = false;

  UploadJob job = { copy, len };
  uploadWorkerBusy = true;
  if (uploadQueue == nullptr || xQueueSend(uploadQueue, &job, 0) != pdTRUE) {
    free(copy);
    uploadWorkerBusy = false;
    pendingCapture = true;
    return false;
  }

  Serial.println("[UPLOAD] queued");
  return true;
}

void IRAM_ATTR pirISR()
{
  pirInterruptFlag = true;
}

void startPIR()
{
  pinMode(PIR_PIN, INPUT_PULLDOWN);
  pirStartupTime = millis();
  pirReady = false;
  pirArmed = false;
  motionActive = false;
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
    pirReady = true;
    pirArmed = true;
    motionActive = false;
    pirLowSince = pirHigh ? 0 : now;
    pirHighSince = pirHigh ? now : 0;
    Serial.println("PIR WARM-UP FINISHED — ready");
    enqueueCapture("pir-ready");
    return;
  }

  if (!pirHigh) {
    pirHighSince = 0;
    if (pirLowSince == 0) pirLowSince = now;
    if (now - pirLowSince >= PIR_REARM_LOW_TIME) {
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
    Serial.println("[PIR] MOTION DETECTED");
    enqueueCapture("first motion");
    return;
  }

  if (motionActive && now - lastMotionCapture >= PIR_CAPTURE_INTERVAL) {
    lastMotionCapture = now;
    enqueueCapture("continuing motion");
  }
}

void setup()
{
  Serial.begin(115200);
  delay(1500);
  Serial.println("======================================");
  Serial.println("  ESP32-CAM  (camera only, no DFPlayer)");
  Serial.println("======================================");
  Serial.printf("Device ID: %s\n", ESP32_ID);

  uploadQueue = xQueueCreate(1, sizeof(UploadJob));
  xTaskCreatePinnedToCore(
    uploadWorkerTask, "vw_upload", UPLOAD_TASK_STACK, nullptr, 1, &uploadTaskHandle, 1
  );

  startPIR();

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
  Serial.println("SYSTEM INITIALIZED — audio is on esp-voice-1");

  if (WiFi.status() == WL_CONNECTED) {
    enqueueCapture("boot");
  }
}

void loop()
{
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWiFiRetry = 0;
    if (millis() - lastWiFiRetry >= 10000) {
      lastWiFiRetry = millis();
      if (!uploadWorkerBusy) connectWiFi();
    }
  }

  checkMotion();
  if (schedulePendingCapture) {
    schedulePendingCapture = false;
    enqueueCapture("pending follow-up");
  }

  static unsigned long lastPIRDiagnostic = 0;
  if (millis() - lastPIRDiagnostic >= 5000) {
    lastPIRDiagnostic = millis();
    if (!pirReady) {
      unsigned long left =
        (PIR_WARMUP_TIME > millis() - pirStartupTime)
          ? (PIR_WARMUP_TIME - (millis() - pirStartupTime)) / 1000
          : 0;
      Serial.printf("[PIR] warming up — %lu s left\n", left);
    }
  }

  delay(10);
}
