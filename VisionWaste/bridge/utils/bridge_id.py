"""
Persistent laptop bridge instance identifier.

Resolution order:
  1. Environment variable VISIONWASTE_BRIDGE_ID (override)
  2. Local file .bridge_id next to bridge.py (survives restarts)
  3. Generate BRIDGE_<hex>, write .bridge_id

Sent with every POST /predict as multipart field bridge_instance_id.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

_ENV_KEY = "VISIONWASTE_BRIDGE_ID"
_FILE_NAME = ".bridge_id"


def _storage_dir() -> Path:
    """VisionWaste/bridge/ (parent of utils/)."""
    return Path(__file__).resolve().parent.parent


def get_bridge_instance_id() -> str:
    env_val = os.environ.get(_ENV_KEY, "").strip()
    if env_val:
        return env_val

    root = _storage_dir()
    path = root / _FILE_NAME
    if path.is_file():
        try:
            existing = path.read_text(encoding="utf-8").strip()
        except OSError:
            existing = ""
        if existing:
            return existing

    new_id = f"BRIDGE_{uuid.uuid4().hex[:12]}"
    path.write_text(new_id + "\n", encoding="utf-8")
    return new_id
