/*
 * VisionWaste ESP32 voice board — DFPlayer only (no camera).
 *
 * Flash this on a second AI-Thinker ESP32-CAM with the camera module removed.
 * It polls Railway for PLAY_AUDIO / STOP_AUDIO and never uploads photos.
 *
 * Wiring (same as before):
 *   ESP32 GPIO13 (U0TXD / pin labeled 13)  ->  DFPlayer RX
 *   ESP32 GND                              ->  DFPlayer GND
 *   5V                                     ->  DFPlayer VCC
 *   Speaker                                ->  DFPlayer SPK_1 / SPK_2
 *   SD card: /MP3/0001.mp3 ... 0004.mp3
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// Wi-Fi, backend URL and device key live in secrets.h (git-ignored).
// Copy secrets.example.h to secrets.h and fill in your values.
#include "secrets.h"

const char* ESP32_ID = "esp-voice-1";

#define MP3_TX_PIN 13
#define MP3_VOLUME 30
#define STARTUP_AUDIO true

const unsigned long COMMAND_INTERVAL = 2000;
const unsigned long COMMAND_HTTP_TIMEOUT_MS = 10000;
const int COMMAND_ACK_RETRIES = 3;

HardwareSerial MP3Serial(1);
unsigned long lastCommandCheck = 0;
String lastPlayedCommandId = "";

bool connectWiFi()
{
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
      Serial.println("Wi-Fi timeout.");
      return false;
    }
  }
  Serial.println();
  Serial.print("Wi-Fi OK  IP=");
  Serial.println(WiFi.localIP());
  return true;
}

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
  delay(80);
}

void resetMP3()
{
  Serial.println("DFPlayer reset...");
  sendMP3Command(0x0C, 0);
  delay(1500);
}

void setMP3Volume(uint8_t volume)
{
  if (volume > 30) volume = 30;
  sendMP3Command(0x06, volume);
}

bool playMP3(uint16_t track)
{
  if (track == 0) return false;
  Serial.printf("[DFPLAYER] PLAY 000%u.mp3\n", track);
  sendMP3Command(0x03, track);
  return true;
}

bool stopMP3()
{
  sendMP3Command(0x16, 0);
  delay(120);
  return true;
}

int findJsonKeyColon(const String& json, const String& key)
{
  String search = "\"" + key + "\"";
  int from = 0;
  while (from < (int)json.length()) {
    int keyPosition = json.indexOf(search, from);
    if (keyPosition < 0) return -1;
    int i = keyPosition + search.length();
    while (i < (int)json.length() &&
           (json[i] == ' ' || json[i] == '\t' || json[i] == '\r' || json[i] == '\n')) {
      i++;
    }
    if (i < (int)json.length() && json[i] == ':') return i;
    from = keyPosition + 1;
  }
  return -1;
}

int skipJsonSpace(const String& json, int start)
{
  while (start < (int)json.length() &&
         (json[start] == ' ' || json[start] == '\t' ||
          json[start] == '\r' || json[start] == '\n')) {
    start++;
  }
  return start;
}

String getJsonString(const String& json, const String& key)
{
  int colonPosition = findJsonKeyColon(json, key);
  if (colonPosition < 0) return "";
  int quoteStart = skipJsonSpace(json, colonPosition + 1);
  if (quoteStart >= (int)json.length() || json[quoteStart] != '"') return "";
  int quoteEnd = json.indexOf('"', quoteStart + 1);
  if (quoteEnd < 0) return "";
  return json.substring(quoteStart + 1, quoteEnd);
}

int getJsonInt(const String& json, const String& key)
{
  int colonPosition = findJsonKeyColon(json, key);
  if (colonPosition < 0) return -1;
  int start = skipJsonSpace(json, colonPosition + 1);
  if (start >= (int)json.length() || json[start] == 'n' || json[start] == '"') {
    return -1;
  }
  int end = start;
  while (end < (int)json.length() && json[end] >= '0' && json[end] <= '9') end++;
  if (end == start) return -1;
  return json.substring(start, end).toInt();
}

bool acknowledgeCommand(const String& commandId, const String& status,
                        const String& errorMessage)
{
  if (commandId.length() == 0 || WiFi.status() != WL_CONNECTED) return false;

  String ackURL = String(BACKEND_BASE) + "/devices/commands/" + commandId + "/ack";
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  bool ok = false;

  if (http.begin(client, ackURL)) {
    http.setTimeout(COMMAND_HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");
    if (strlen(DEVICE_API_KEY) > 0) {
      http.addHeader("X-Device-Key", DEVICE_API_KEY);
    }
    String json = "{\"esp32_id\":\"" + String(ESP32_ID) + "\",\"status\":\"" + status + "\"";
    if (errorMessage.length() > 0) {
      json += ",\"error_message\":\"" + errorMessage + "\"";
    }
    json += "}";
    int code = http.POST(json);
    Serial.printf("[ACK] %s HTTP %d\n", status.c_str(), code);
    ok = (code >= 200 && code < 300);
    http.end();
  }
  return ok;
}

void acknowledgeCommandWithRetry(const String& commandId, const String& status,
                                 const String& errorMessage)
{
  for (int attempt = 1; attempt <= COMMAND_ACK_RETRIES; attempt++) {
    if (acknowledgeCommand(commandId, status, errorMessage)) return;
    delay(250);
  }
  Serial.println("[ACK] failed after retries");
}

void handleQueuedCommand(const String& response)
{
  if (response.indexOf("PLAY_AUDIO") < 0 && response.indexOf("STOP_AUDIO") < 0) {
    return;
  }

  String commandId = getJsonString(response, "audio_command_id");
  if (commandId.length() == 0) commandId = getJsonString(response, "id");
  if (commandId.length() == 0) commandId = getJsonString(response, "command_id");

  String command = getJsonString(response, "audio_action");
  if (command.length() == 0) command = getJsonString(response, "action");
  if (command != "PLAY_AUDIO" && command != "STOP_AUDIO") {
    if (response.indexOf("PLAY_AUDIO") >= 0) command = "PLAY_AUDIO";
    else if (response.indexOf("STOP_AUDIO") >= 0) command = "STOP_AUDIO";
  }

  int track = getJsonInt(response, "audio_track");
  if (track <= 0) track = getJsonInt(response, "track");

  Serial.printf("[COMMAND] cmd=%s id=%s track=%d\n",
                command.c_str(), commandId.c_str(), track);

  if (command == "PLAY_AUDIO") {
    if (commandId.length() == 0 || track <= 0) return;
    if (commandId == lastPlayedCommandId) {
      acknowledgeCommandWithRetry(commandId, "completed", "");
      return;
    }
    bool played = playMP3((uint16_t)track);
    if (played) lastPlayedCommandId = commandId;
    acknowledgeCommandWithRetry(
      commandId,
      played ? "completed" : "failed",
      played ? "" : "DFPlayer play failed"
    );
    return;
  }

  if (command == "STOP_AUDIO" && commandId.length() > 0) {
    lastPlayedCommandId = "";
    stopMP3();
    acknowledgeCommandWithRetry(commandId, "completed", "");
  }
}

void checkForCommand()
{
  if (WiFi.status() != WL_CONNECTED) return;

  String url = String(BACKEND_BASE) + "/devices/commands?esp32_id=" + String(ESP32_ID);
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (!http.begin(client, url)) {
    Serial.println("[POLL] begin failed");
    return;
  }

  http.setTimeout(COMMAND_HTTP_TIMEOUT_MS);
  http.addHeader("Accept", "application/json");
  if (strlen(DEVICE_API_KEY) > 0) {
    http.addHeader("X-Device-Key", DEVICE_API_KEY);
  }
  int code = http.GET();
  if (code >= 200 && code < 300) {
    String response = http.getString();
    http.end();
    Serial.println("[POLL] OK");
    handleQueuedCommand(response);
    return;
  }

  Serial.printf("[POLL] HTTP %d\n", code);
  http.end();
}

void setup()
{
  Serial.begin(115200);
  delay(1500);
  Serial.println("======================================");
  Serial.println("  ESP32 VOICE  (DFPlayer only)");
  Serial.println("======================================");
  Serial.printf("Voice ID: %s\n", ESP32_ID);
  Serial.println("DFPlayer TX GPIO13 -> DFPlayer RX");

  MP3Serial.begin(9600, SERIAL_8N1, -1, MP3_TX_PIN);
  delay(1000);
  resetMP3();
  setMP3Volume(MP3_VOLUME);
  if (STARTUP_AUDIO) {
    Serial.println("Startup track 0001.mp3");
    playMP3(1);
  }

  if (!connectWiFi()) {
    Serial.println("Wi-Fi failed — will retry.");
  }

  lastCommandCheck = millis();
  Serial.println("Listening for PLAY_AUDIO every 2s");
}

void loop()
{
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastRetry = 0;
    if (millis() - lastRetry >= 10000) {
      lastRetry = millis();
      connectWiFi();
    }
  } else if (millis() - lastCommandCheck >= COMMAND_INTERVAL) {
    lastCommandCheck = millis();
    checkForCommand();
  }

  delay(10);
}
