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
OPENWEATHER_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"
CACHE_TTL_SEC = 600  # 10 minutes
FORECAST_CACHE_TTL_SEC = 1800  # 30 minutes (forecast doesn't change as often)
HTTP_TIMEOUT_SEC = 5.0

_cache: dict[tuple[float, float], tuple[float, dict[str, Any]]] = {}
_forecast_cache: dict[tuple[float, float, int], tuple[float, list[dict[str, Any]]]] = {}


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


def _stub_forecast(lat: float, lng: float, hours_ahead: int) -> list[dict[str, Any]]:
    """Deterministic 3-hourly forecast stub.

    Uses a simple sinusoidal day/night curve so the timeline shows a
    visible pattern even without an OpenWeather key.
    """
    import math

    base = _stub_weather(lat, lng)
    now_ts = time.time()
    slots: list[dict[str, Any]] = []

    for step in range(1, hours_ahead // 3 + 1):
        future = now_ts + step * 3 * 3600
        hour_of_day = (time.gmtime(future).tm_hour + 5) % 24  # roughly local
        # Day/night swing: warmest ~14:00, coolest ~04:00.
        diurnal = math.sin(((hour_of_day - 4) / 24.0) * 2 * math.pi)
        temp = round(base["temp_c"] + 3.0 * diurnal, 1)
        # Humidity moves opposite to temperature.
        hum = round(max(40.0, min(95.0, base["humidity_pct"] - 8.0 * diurnal)), 1)
        slots.append(
            {
                "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(future)) + "Z",
                "ts_unix": future,
                "temp_c": temp,
                "humidity_pct": hum,
                "condition": "Stub",
                "description": "stubbed forecast",
                "source": "stub",
            }
        )
    return slots


def _from_openweather_forecast(payload: dict[str, Any], hours_ahead: int) -> list[dict[str, Any]]:
    items = payload.get("list") or []
    out: list[dict[str, Any]] = []
    cutoff = time.time() + hours_ahead * 3600
    for item in items:
        ts_unix = float(item.get("dt", 0))
        if ts_unix > cutoff:
            break
        main = item.get("main", {}) or {}
        weather_arr = item.get("weather") or [{}]
        out.append(
            {
                "ts": item.get("dt_txt", "") or time.strftime(
                    "%Y-%m-%dT%H:%M:%S", time.gmtime(ts_unix)
                ),
                "ts_unix": ts_unix,
                "temp_c": float(main.get("temp", 0.0)),
                "humidity_pct": float(main.get("humidity", 0.0)),
                "condition": (weather_arr[0] or {}).get("main", "Unknown"),
                "description": (weather_arr[0] or {}).get("description", ""),
                "source": "openweather",
            }
        )
    return out


def get_forecast(lat: float, lng: float, hours_ahead: int = 24) -> list[dict[str, Any]]:
    """Return 3-hour-spaced weather predictions covering the next N hours.

    Falls back to a deterministic stub when no API key is set or the
    network call fails. Each slot has the same shape as ``get_current_weather``
    plus ``ts`` / ``ts_unix``.
    """
    hours_ahead = max(3, min(120, int(hours_ahead)))
    key = (round(lat, 3), round(lng, 3), hours_ahead)
    now = time.time()

    cached = _forecast_cache.get(key)
    if cached and (now - cached[0]) < FORECAST_CACHE_TTL_SEC:
        return cached[1]

    if not OPENWEATHER_API_KEY:
        data = _stub_forecast(lat, lng, hours_ahead)
        _forecast_cache[key] = (now, data)
        return data

    try:
        with httpx.Client(timeout=HTTP_TIMEOUT_SEC) as client:
            r = client.get(
                OPENWEATHER_FORECAST_URL,
                params={
                    "lat": lat,
                    "lon": lng,
                    "appid": OPENWEATHER_API_KEY,
                    "units": "metric",
                },
            )
            r.raise_for_status()
            data = _from_openweather_forecast(r.json(), hours_ahead)
            if not data:
                data = _stub_forecast(lat, lng, hours_ahead)
    except Exception as e:
        data = _stub_forecast(lat, lng, hours_ahead)
        for slot in data:
            slot["error"] = f"{type(e).__name__}: {e}"
            slot["source"] = "stub-fallback"

    _forecast_cache[key] = (now, data)
    return data
