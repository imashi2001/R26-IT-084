/*
 * =============================================================================
 *  VisionWaste — ESP32 Voice Player  (speaker board only)
 * =============================================================================
 *
 * ROLE IN THE SYSTEM
 *   Companion board to ESP32CamDirectPredict.ino. This firmware NEVER takes
 *   photos. It only:
 *     1) Polls Railway  GET /devices/commands?esp32_id=<ESP32_ID>
 *     2) Plays DFPlayer tracks for PLAY_AUDIO (or stops on STOP_AUDIO)
 *     3) ACKs           POST /devices/commands/:id/ack
 *
 *   Camera analyze → backend audioTriggerService queues PLAY_AUDIO for
 *   Device.audio_esp32_id (must equal ESP32_ID below, e.g. "esp-voice-1").
 *
 * HARDWARE
 *   Flash on a second AI-Thinker ESP32-CAM with the camera module removed
 *   (or any ESP32 with free UART TX). Wiring:
 *
 *     ESP32 GPIO13 (U0TXD / labeled 13)  ---->  DFPlayer RX
 *     ESP32 GND                          ---->  DFPlayer GND
 *     5V                                 ---->  DFPlayer VCC
 *     Speaker                            ---->  DFPlayer SPK_1 / SPK_2
 *
 *   MicroSD on the DFPlayer must contain:
 *     /MP3/0001.mp3  …  /MP3/000N.mp3
 *   Track numbers match Speaker Check → Audio track assignment on the web UI
 *   (illegal_dumping, waste_full, animal_detected, correct_dumping, …).
 *
 * CREDENTIALS
 *   Wi-Fi + BACKEND_BASE + DEVICE_API_KEY live in secrets.h (git-ignored).
 *   Copy secrets.example.h → secrets.h and fill values.
 * =============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

#include "secrets.h"

/* Must match Device.audio_esp32_id for the bin that owns the camera. */
const char* ESP32_ID = "esp-voice-1";

/* UART TX only (no RX from DFPlayer required for basic play/stop). */
#define MP3_TX_PIN 13
#define MP3_VOLUME 30          // DFPlayer volume 0–30
#define STARTUP_AUDIO true     // Play track 1 once at boot (wiring smoke test)

const unsigned long COMMAND_INTERVAL = 2000;       // Poll period
const unsigned long COMMAND_HTTP_TIMEOUT_MS = 10000;
const int COMMAND_ACK_RETRIES = 3;

HardwareSerial MP3Serial(1);   // UART1 → DFPlayer
unsigned long lastCommandCheck = 0;
String lastPlayedCommandId = ""; // Deduplicate if poll returns the same command twice

/* =============================================================================
 * Wi-Fi
 * ========================================================================== */

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

/* =============================================================================
 * DFPlayer Mini — serial protocol (0x7E … 0xEF packets)
 * Commands used: 0x03 play track, 0x06 volume, 0x0C reset, 0x16 stop
 * ========================================================================== */

void sendMP3Command(uint8_t command, uint16_t parameter)
{
  uint8_t packet[10];
  packet[0] = 0x7E;
  packet[1] = 0xFF;
  packet[2] = 0x06;
  packet[3] = command;
  packet[4] = 0x00; // no feedback requested
  packet[5] = (parameter >> 8) & 0xFF;
  packet[6] = parameter & 0xFF;
  uint16_t sum = packet[1] + packet[2] + packet[3] + packet[4] + packet[5] + packet[6];
  uint16_t checksum = 0 - sum;
  packet[7] = (checksum >> 8) & 0xFF;
  packet[8] = checksum & 0xFF;
  packet[9] = 0xEF;
  MP3Serial.write(packet, sizeof(packet));
  MP3Serial.flush();
  delay(80); // Give the module time to latch the command
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

/** Play /MP3/000N.mp3 where N = track (1 → 0001.mp3). */
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

/* =============================================================================
 * Tiny JSON helpers (no ArduinoJson dependency — keeps flash small)
 * Finds "key": "value" or "key": 123 in the poll/ack payloads.
 * ========================================================================== */

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

/* =============================================================================
 * Backend ACK — tells Railway the command finished (or failed) so it is not
 * re-delivered forever. Status strings: "completed" | "failed"
 * ========================================================================== */

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

/**
 * Parse one poll response and act.
 * Backend field names vary slightly across revisions; we accept several aliases:
 *   id / command_id / audio_command_id
 *   action / audio_action
 *   track / audio_track
 */
void handleQueuedCommand(const String& response)
{
  if (response.indexOf("PLAY_AUDIO") < 0 && response.indexOf("STOP_AUDIO") < 0) {
    return; // Empty queue or unrelated JSON
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
    /* Same command id again → already handled; ACK completed to clear queue. */
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

/** Pull the next pending command for this voice ESP32 id (if any). */
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

/* =============================================================================
 * Arduino entry points
 * ========================================================================== */

void setup()
{
  Serial.begin(115200);
  delay(1500);
  Serial.println("======================================");
  Serial.println("  ESP32 VOICE  (DFPlayer only)");
  Serial.println("======================================");
  Serial.printf("Voice ID: %s\n", ESP32_ID);
  Serial.println("DFPlayer TX GPIO13 -> DFPlayer RX");

  /* RX pin -1: we only transmit commands to the DFPlayer. */
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
