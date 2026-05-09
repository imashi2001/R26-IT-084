#!/usr/bin/env python3
"""
VisionWaste bridge — ESP32-CAM snapshot → Express backend POST /predict

Runs on a laptop on the same LAN as the ESP32. Railway cannot reach private IPs
like 10.x.x.x; this script pulls JPEG bytes locally and uploads them over HTTPS.

Backend contract (Express): POST multipart/form-data, field name "image".
Response: JSON array of detections [{ label, confidence, box }, ...].
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# --- Configuration (override with environment variables) ---

ESP32_CAPTURE_URL = os.environ.get(
    "ESP32_CAPTURE_URL",
    "http://10.134.126.191/capture",
)

BACKEND_PREDICT_URL = os.environ.get(
    "BACKEND_PREDICT_URL",
    "https://YOUR-BACKEND.up.railway.app/predict",
)

POLL_INTERVAL_SEC = float(os.environ.get("POLL_INTERVAL_SEC", "60"))

ESP32_TIMEOUT = float(os.environ.get("ESP32_TIMEOUT", "10"))
BACKEND_TIMEOUT = float(os.environ.get("BACKEND_TIMEOUT", "120"))

BACKEND_MAX_RETRIES = int(os.environ.get("BACKEND_MAX_RETRIES", "3"))
BACKEND_RETRY_DELAY_SEC = float(os.environ.get("BACKEND_RETRY_DELAY_SEC", "2"))

SCRIPT_DIR = Path(__file__).resolve().parent
CAPTURES_DIR = SCRIPT_DIR / "captures"
LATEST_IMAGE_PATH = CAPTURES_DIR / "latest.jpg"


def ensure_captures_dir() -> None:
    CAPTURES_DIR.mkdir(parents=True, exist_ok=True)


def fetch_image_from_esp32() -> bytes:
    print("Getting image from ESP32...")
    resp = requests.get(ESP32_CAPTURE_URL, timeout=ESP32_TIMEOUT)
    resp.raise_for_status()

    if not resp.content:
        raise ValueError("ESP32 returned empty body")

    if not resp.content.startswith(b"\xff\xd8"):
        print(
            "Warning: body does not look like JPEG (FF D8). Continuing anyway.",
            file=sys.stderr,
        )

    return resp.content


def save_latest_capture(image_bytes: bytes) -> None:
    ensure_captures_dir()
    LATEST_IMAGE_PATH.write_bytes(image_bytes)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    (CAPTURES_DIR / f"snapshot_{stamp}.jpg").write_bytes(image_bytes)


def post_predict_with_retries(image_bytes: bytes) -> requests.Response:
    print("Sending image to backend...")
    files = {"image": ("capture.jpg", image_bytes, "image/jpeg")}
    last_exc: Exception | None = None

    for attempt in range(1, BACKEND_MAX_RETRIES + 1):
        try:
            resp = requests.post(
                BACKEND_PREDICT_URL,
                files=files,
                timeout=BACKEND_TIMEOUT,
            )
            if resp.status_code >= 500:
                raise requests.HTTPError(f"HTTP {resp.status_code}")
            return resp
        except (requests.RequestException, requests.HTTPError) as e:
            last_exc = e
            print(
                f"Backend request failed ({attempt}/{BACKEND_MAX_RETRIES}): {e}",
                file=sys.stderr,
            )
            if attempt < BACKEND_MAX_RETRIES:
                time.sleep(BACKEND_RETRY_DELAY_SEC)

    assert last_exc is not None
    raise last_exc


def print_prediction_payload(resp: requests.Response) -> None:
    print("Prediction received")
    try:
        data = resp.json()
    except json.JSONDecodeError:
        print("Non-JSON response:", resp.text[:500], file=sys.stderr)
        return
    print(json.dumps(data, indent=2))


def validate_config() -> None:
    if "YOUR-BACKEND" in BACKEND_PREDICT_URL:
        print(
            "Set BACKEND_PREDICT_URL to your Railway Express API, full URL with https://, e.g.\n"
            "  PowerShell: $env:BACKEND_PREDICT_URL='https://xxx.up.railway.app/predict'\n"
            "  bash: export BACKEND_PREDICT_URL=https://xxx.up.railway.app/predict",
            file=sys.stderr,
        )


def main() -> None:
    validate_config()
    ensure_captures_dir()

    print("VisionWaste bridge started.")
    print(f"  ESP32:    {ESP32_CAPTURE_URL}")
    print(f"  Backend:  {BACKEND_PREDICT_URL}")
    print(f"  Interval: {POLL_INTERVAL_SEC}s")
    print("Ctrl+C to stop.\n")

    while True:
        try:
            image_bytes = fetch_image_from_esp32()
            save_latest_capture(image_bytes)
            resp = post_predict_with_retries(image_bytes)

            if not resp.ok:
                print(
                    f"HTTP {resp.status_code}: {resp.text[:400]}",
                    file=sys.stderr,
                )
            else:
                print_prediction_payload(resp)

        except requests.Timeout as e:
            print(f"Timeout: {e}", file=sys.stderr)
        except requests.RequestException as e:
            print(f"Network error: {e}", file=sys.stderr)
        except ValueError as e:
            print(f"Data error: {e}", file=sys.stderr)
        except KeyboardInterrupt:
            print("\nStopping.")
            raise SystemExit(0)
        except Exception as e:
            print(f"Unexpected: {e}", file=sys.stderr)

        time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    main()
