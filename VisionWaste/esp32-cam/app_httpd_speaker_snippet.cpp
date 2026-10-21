/**
 * Paste these handlers + URI registrations into your CameraWebServer app_httpd.cpp
 * (alongside capture_handler / startCameraServer).
 *
 * Requires speaker.h / speaker.cpp in the sketch folder, and speaker_begin()
 * called once from setup() after WiFi (or before startCameraServer).
 *
 * New routes:
 *   GET /speaker/test   — short ascending beeps
 *   GET /alarm          — illegal-dump / don't-throw alarm pattern
 *   GET /speaker/status — JSON pin + IP
 */

#if 0  // set to 1 when merging, or copy bodies into your sketch

#include "speaker.h"
#include <WiFi.h>

static esp_err_t speaker_test_handler(httpd_req_t *req) {
  speaker_play_test();
  const char *json = "{\"ok\":true,\"mode\":\"test\"}";
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, json, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t alarm_handler(httpd_req_t *req) {
  speaker_play_alarm();
  const char *json = "{\"ok\":true,\"mode\":\"illegal\"}";
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, json, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t speaker_status_handler(httpd_req_t *req) {
  char json[160];
  snprintf(
    json,
    sizeof(json),
    "{\"ok\":true,\"speaker_pin\":%d,\"wifi_ip\":\"%s\"}",
    speaker_pin(),
    WiFi.localIP().toString().c_str()
  );
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, json, HTTPD_RESP_USE_STRLEN);
}

// Inside startCameraServer(), after capture_uri registration:

httpd_uri_t speaker_test_uri = {
  .uri = "/speaker/test",
  .method = HTTP_GET,
  .handler = speaker_test_handler,
  .user_ctx = NULL
};

httpd_uri_t alarm_uri = {
  .uri = "/alarm",
  .method = HTTP_GET,
  .handler = alarm_handler,
  .user_ctx = NULL
};

httpd_uri_t speaker_status_uri = {
  .uri = "/speaker/status",
  .method = HTTP_GET,
  .handler = speaker_status_handler,
  .user_ctx = NULL
};

// httpd_register_uri_handler(camera_httpd, &speaker_test_uri);
// httpd_register_uri_handler(camera_httpd, &alarm_uri);
// httpd_register_uri_handler(camera_httpd, &speaker_status_uri);

// In setup(), after camera init / before or after WiFi:
// speaker_begin();

#endif
