#pragma once
// Copy this file to secrets.h (same folder) and fill in real values.
// secrets.h is git-ignored so credentials never reach the repository.

const char* WIFI_SSID = "your-wifi-name";
const char* WIFI_PASSWORD = "your-wifi-password";

// Railway backend, no trailing slash.
const char* BACKEND_BASE = "https://your-backend.up.railway.app";

// Must match DEVICE_API_KEY on the backend. Leave "" if the backend has none.
const char* DEVICE_API_KEY = "";
