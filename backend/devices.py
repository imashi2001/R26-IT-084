"""Device identity for the IoT side.

The deployment uses a laptop running on the same LAN as an ESP32-CAM as
a bridge: the laptop polls the camera for a JPEG and forwards it to this
backend (we are hosted on Railway, which cannot reach private LAN IPs
directly). The "PC ID" of that bridge laptop acts as the IoT device ID.

Resolution order for the device id:
  1. Multipart form field ``device_id`` or ``bridge_instance_id`` on the
     incoming request (preferred — sent by the bridge).
  2. ``VISIONWASTE_BRIDGE_ID`` environment variable.
  3. A persisted file ``backend/.device_id`` with a stable BRIDGE_<hex>.

The same scheme matches the laptop bridge in ``VisionWaste/bridge`` on
the ``test`` branch so messages line up across the system.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

_ENV_KEY = "VISIONWASTE_BRIDGE_ID"
_FILE_NAME = ".device_id"


def _storage_dir() -> Path:
    return Path(__file__).resolve().parent


def _read_or_create_local() -> str:
    path = _storage_dir() / _FILE_NAME
    if path.is_file():
        try:
            existing = path.read_text(encoding="utf-8").strip()
        except OSError:
            existing = ""
        if existing:
            return existing
    new_id = f"BRIDGE_{uuid.uuid4().hex[:12]}"
    try:
        path.write_text(new_id + "\n", encoding="utf-8")
    except OSError:
        pass
    return new_id


def resolve_device_id(*candidates: str | None) -> str:
    """Pick the first non-empty caller-supplied id, else env, else local."""
    for c in candidates:
        if c and c.strip():
            return c.strip()
    env_val = os.environ.get(_ENV_KEY, "").strip()
    if env_val:
        return env_val
    return _read_or_create_local()


def server_device_id() -> str:
    """ID of the *server* host (Railway dyno or local dev)."""
    env_val = os.environ.get(_ENV_KEY, "").strip()
    if env_val:
        return env_val
    return _read_or_create_local()
