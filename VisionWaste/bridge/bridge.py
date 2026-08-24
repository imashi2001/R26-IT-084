#!/usr/bin/env python3
"""
VisionWaste bridge — ESP32-CAM snapshot → Express backend POST /predict

Runs on a laptop on the same LAN as the ESP32. Railway cannot reach private IPs
like 10.x.x.x; this script pulls JPEG bytes locally and uploads them over HTTPS.

Also:
  - Triggers GET {ESP32}/alarm when predict risk is HIGH/CRITICAL or animals seen
  - Polls GET /bridge/speaker-pending and relays test/alarm to the ESP32

Backend contract (Express): POST multipart/form-data fields: image (required),
bridge_instance_id (always), esp32_id (optional), source_type=esp32 (recommended).

Poll interval: POLL_INTERVAL_SEC or VISIONWASTE_POLL_SECONDS (minimum 60s).
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import requests

from utils.bridge_id import get_bridge_instance_id

# --- Configuration (override with environment variables) ---

ESP32_CAPTURE_URL = os.environ.get(
    "ESP32_CAPTURE_URL",
    "http://10.134.126.191/capture",
)

BACKEND_PREDICT_URL = os.environ.get(
    "BACKEND_PREDICT_URL",
    "https://caring-light-production.up.railway.app/predict",
)

_poll_raw = os.environ.get("VISIONWASTE_POLL_SECONDS") or os.environ.get(
    "POLL_INTERVAL_SEC", "60"
)
try:
    POLL_INTERVAL_SEC = float(_poll_raw)
except ValueError:
    POLL_INTERVAL_SEC = 60.0

# Enforce the project requirement: capture every 60s (minimum).
if POLL_INTERVAL_SEC < 60:
    print(
        f"Warning: POLL_INTERVAL_SEC={POLL_INTERVAL_SEC} is too small. "
        "Forcing to 60 seconds.",
        file=sys.stderr,
    )
    POLL_INTERVAL_SEC = 60.0

ESP32_TIMEOUT = float(os.environ.get("ESP32_TIMEOUT", "10"))
BACKEND_TIMEOUT = float(os.environ.get("BACKEND_TIMEOUT", "120"))
SPEAKER_TIMEOUT = float(os.environ.get("SPEAKER_TIMEOUT", "30"))

BACKEND_MAX_RETRIES = int(os.environ.get("BACKEND_MAX_RETRIES", "3"))
BACKEND_RETRY_DELAY_SEC = float(os.environ.get("BACKEND_RETRY_DELAY_SEC", "2"))

# Sent as multipart field alongside `image` so the backend can attach captures to a Device row.
DEVICE_ESP32_ID = os.environ.get("DEVICE_ESP32_ID", "").strip()

# Stable per-laptop ID (file .bridge_id or VISIONWASTE_BRIDGE_ID env).
BRIDGE_INSTANCE_ID = get_bridge_instance_id()

ESP32_ALARM_ENABLED = os.environ.get("ESP32_ALARM_ENABLED", "1").strip() not in (
    "0",
    "false",
    "False",
    "no",
    "NO",
)
# Comma-separated risk levels that trigger /alarm (default HIGH).
_ALARM_ON_RISK = os.environ.get("ALARM_ON_RISK", "HIGH,CRITICAL")
ALARM_ON_RISK_LEVELS = {
    part.strip().upper() for part in _ALARM_ON_RISK.split(",") if part.strip()
}

SPEAKER_POLL_SEC = float(os.environ.get("SPEAKER_POLL_SEC", "5"))

SCRIPT_DIR = Path(__file__).resolve().parent
CAPTURES_DIR = SCRIPT_DIR / "captures"
LATEST_IMAGE_PATH = CAPTURES_DIR / "latest.jpg"


def esp32_base_url(capture_url: str | None = None) -> str:
    """http://IP/capture → http://IP"""
    raw = (capture_url or ESP32_CAPTURE_URL).strip().rstrip("/")
    if raw.lower().endswith("/capture"):
        raw = raw[: -len("/capture")]
    return raw.rstrip("/")


def backend_root_url() -> str:
    """https://host/predict → https://host"""
    parsed = urlparse(BACKEND_PREDICT_URL)
    path = parsed.path or ""
    if path.rstrip("/").endswith("/predict"):
        path = path[: path.rstrip("/").rfind("/predict")] or "/"
    if not path:
        path = "/"
    return urlunparse((parsed.scheme, parsed.netloc, path.rstrip("/") or "", "", "", "")).rstrip(
        "/"
    )


ESP32_BASE_URL = esp32_base_url()
BACKEND_ROOT_URL = backend_root_url()


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
    data: dict[str, str] = {
        "bridge_instance_id": BRIDGE_INSTANCE_ID,
        "source_type": "esp32",
    }
    if DEVICE_ESP32_ID:
        data["esp32_id"] = DEVICE_ESP32_ID
    last_exc: Exception | None = None

    for attempt in range(1, BACKEND_MAX_RETRIES + 1):
        try:
            resp = requests.post(
                BACKEND_PREDICT_URL,
                files=files,
                data=data,
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


def call_esp32_speaker(path: str, base: str | None = None) -> bool:
    """GET /speaker/test or /alarm on the camera. Returns True on HTTP success."""
    root = (base or ESP32_BASE_URL).rstrip("/")
    url = f"{root}{path if path.startswith('/') else '/' + path}"
    try:
        print(f"ESP32 speaker → {url}")
        resp = requests.get(url, timeout=SPEAKER_TIMEOUT)
        if not resp.ok:
            print(
                f"ESP32 speaker HTTP {resp.status_code}: {resp.text[:200]}",
                file=sys.stderr,
            )
            return False
        print(f"ESP32 speaker OK ({path})")
        return True
    except requests.RequestException as e:
        print(f"ESP32 speaker failed: {e}", file=sys.stderr)
        return False


def should_trigger_alarm(payload: object) -> bool:
    if not isinstance(payload, dict):
        return False

    risk = payload.get("risk")
    if isinstance(risk, dict):
        level = str(risk.get("level") or "").strip().upper()
        if level and level in ALARM_ON_RISK_LEVELS:
            return True

    animal = payload.get("animal")
    if isinstance(animal, dict):
        count = animal.get("detection_count")
        try:
            if int(count) > 0:
                return True
        except (TypeError, ValueError):
            pass
        dets = animal.get("detections")
        if isinstance(dets, list) and len(dets) > 0:
            return True

    return False


def handle_prediction_alarm(resp: requests.Response) -> None:
    print("Prediction received")
    try:
        data = resp.json()
    except json.JSONDecodeError:
        print("Non-JSON response:", resp.text[:500], file=sys.stderr)
        return

    print(json.dumps(data, indent=2))

    if not ESP32_ALARM_ENABLED:
        return
    if should_trigger_alarm(data):
        print("Risk/animal trigger → sounding ESP32 /alarm")
        call_esp32_speaker("/alarm")


def ack_speaker_command(device_id: int) -> None:
    url = f"{BACKEND_ROOT_URL}/bridge/speaker-ack"
    try:
        requests.post(
            url,
            json={"device_id": device_id},
            timeout=BACKEND_TIMEOUT,
        )
    except requests.RequestException as e:
        print(f"speaker-ack failed: {e}", file=sys.stderr)


def poll_and_relay_speaker_commands() -> None:
    """Fetch pending website Test speaker (or alarm) and hit the ESP32."""
    params: dict[str, str] = {"bridge_instance_id": BRIDGE_INSTANCE_ID}
    if DEVICE_ESP32_ID:
        params["esp32_id"] = DEVICE_ESP32_ID

    url = f"{BACKEND_ROOT_URL}/bridge/speaker-pending"
    try:
        resp = requests.get(url, params=params, timeout=BACKEND_TIMEOUT)
    except requests.RequestException as e:
        print(f"speaker-pending poll failed: {e}", file=sys.stderr)
        return

    if not resp.ok:
        print(
            f"speaker-pending HTTP {resp.status_code}: {resp.text[:200]}",
            file=sys.stderr,
        )
        return

    try:
        body = resp.json()
    except json.JSONDecodeError:
        return

    if not body.get("pending"):
        return

    action = str(body.get("action") or "").strip().lower()
    device_id = body.get("device_id")
    cam = (body.get("camera_base_url") or "").strip().rstrip("/") or None
    base = cam or ESP32_BASE_URL

    if action == "test":
        path = "/speaker/test"
    elif action == "alarm":
        path = "/alarm"
    else:
        print(f"Unknown pending speaker action: {action}", file=sys.stderr)
        if device_id is not None:
            try:
                ack_speaker_command(int(device_id))
            except (TypeError, ValueError):
                pass
        return

    print(f"Pending speaker command: action={action} device_id={device_id}")
    ok = call_esp32_speaker(path, base=base)
    if device_id is not None:
        try:
            ack_speaker_command(int(device_id))
            if ok:
                print(f"Acked speaker command for device {device_id}")
        except (TypeError, ValueError):
            pass


def speaker_poll_loop(stop_event: threading.Event) -> None:
    while not stop_event.is_set():
        try:
            poll_and_relay_speaker_commands()
        except Exception as e:  # noqa: BLE001 — keep thread alive
            print(f"Speaker poll unexpected: {e}", file=sys.stderr)
        stop_event.wait(SPEAKER_POLL_SEC)


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
    print(f"  ESP32 base: {ESP32_BASE_URL}")
    print(f"  Backend:  {BACKEND_PREDICT_URL}")
    print(f"  Backend root: {BACKEND_ROOT_URL}")
    print(f"  Bridge:   bridge_instance_id={BRIDGE_INSTANCE_ID}")
    if DEVICE_ESP32_ID:
        print(f"  Device:   esp32_id={DEVICE_ESP32_ID}")
    print(f"  Interval: {POLL_INTERVAL_SEC}s")
    print(f"  Alarm:    enabled={ESP32_ALARM_ENABLED} levels={sorted(ALARM_ON_RISK_LEVELS)}")
    print(f"  Speaker poll: every {SPEAKER_POLL_SEC}s")
    print("Ctrl+C to stop.\n")

    stop_event = threading.Event()
    speaker_thread = threading.Thread(
        target=speaker_poll_loop,
        args=(stop_event,),
        name="speaker-poll",
        daemon=True,
    )
    speaker_thread.start()

    try:
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
                    handle_prediction_alarm(resp)

            except requests.Timeout as e:
                print(f"Timeout: {e}", file=sys.stderr)
            except requests.RequestException as e:
                print(f"Network error: {e}", file=sys.stderr)
            except ValueError as e:
                print(f"Data error: {e}", file=sys.stderr)
            except Exception as e:
                print(f"Unexpected: {e}", file=sys.stderr)

            time.sleep(POLL_INTERVAL_SEC)
    except KeyboardInterrupt:
        print("\nStopping.")
        stop_event.set()
        raise SystemExit(0)


if __name__ == "__main__":
    main()
