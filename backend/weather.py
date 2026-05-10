"""OpenWeather adapter with offline stub fallback.

Real mode (when OPENWEATHER_API_KEY is set) hits OpenWeather's free
"current weather" endpoint. Otherwise we return a deterministic stub
based on lat/lng so the rest of the system can still demo end-to-end
without a network call.

Responses are cached per (lat, lng) for CACHE_TTL_SEC seconds so we do
not hammer the free tier and so unit-style tests stay fast.
"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx


OPENWEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY", "").strip()
OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
CACHE_TTL_SEC = 600  # 10 minutes
HTTP_TIMEOUT_SEC = 5.0

_cache: dict[tuple[float, float], tuple[float, dict[str, Any]]] = {}


def _stub_weather(lat: float, lng: float) -> dict[str, Any]:
    # Deterministic-ish stub so the demo isn't boring but is reproducible.
    base_temp = 28.0 + ((abs(lat) + abs(lng)) % 5)
    base_hum = 65.0 + ((abs(lng) * 3) % 20)
    return {
        "temp_c": round(base_temp, 1),
        "humidity_pct": round(base_hum, 1),
        "condition": "Stub",
        "description": "stubbed weather (set OPENWEATHER_API_KEY for live data)",
        "source": "stub",
        "fetched_at": time.time(),
    }


def _from_openweather(payload: dict[str, Any]) -> dict[str, Any]:
    main = payload.get("main", {}) or {}
    weather_arr = payload.get("weather") or [{}]
    return {
        "temp_c": float(main.get("temp", 0.0)),
        "humidity_pct": float(main.get("humidity", 0.0)),
        "condition": (weather_arr[0] or {}).get("main", "Unknown"),
        "description": (weather_arr[0] or {}).get("description", ""),
        "source": "openweather",
        "fetched_at": time.time(),
    }


def get_current_weather(lat: float, lng: float) -> dict[str, Any]:
    key = (round(lat, 3), round(lng, 3))
    now = time.time()

    cached = _cache.get(key)
    if cached and (now - cached[0]) < CACHE_TTL_SEC:
        return cached[1]

    if not OPENWEATHER_API_KEY:
        data = _stub_weather(lat, lng)
        _cache[key] = (now, data)
        return data

    try:
        with httpx.Client(timeout=HTTP_TIMEOUT_SEC) as client:
            r = client.get(
                OPENWEATHER_URL,
                params={
                    "lat": lat,
                    "lon": lng,
                    "appid": OPENWEATHER_API_KEY,
                    "units": "metric",
                },
            )
            r.raise_for_status()
            data = _from_openweather(r.json())
    except Exception as e:
        data = _stub_weather(lat, lng)
        data["error"] = f"{type(e).__name__}: {e}"
        data["source"] = "stub-fallback"

    _cache[key] = (now, data)
    return data
