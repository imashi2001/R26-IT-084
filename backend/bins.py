"""In-memory bin registry for R26-IT-084.

Holds a small fixed set of demo bins (id, friendly name, lat/lng, last
emptied timestamp, default fill level). Other modules read from this
without caring about persistence; swapping this for MongoDB later only
touches this file.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any


def _now() -> datetime:
    return datetime.now(timezone.utc)


# Seed timestamps so demo bins look like they were cleaned at varying
# times. Hours-since-clean drives part of the risk score.
_BASE = _now()


_BINS: dict[str, dict[str, Any]] = {
    "BIN-A12": {
        "id": "BIN-A12",
        "name": "City Hall",
        "lat": 6.9271,
        "lng": 79.8612,
        "last_emptied_at": _BASE - timedelta(hours=4),
        "fill_level_pct": 55,
        "scatter_severity": 0,
    },
    "BIN-B07": {
        "id": "BIN-B07",
        "name": "Park Gate",
        "lat": 6.9100,
        "lng": 79.8700,
        "last_emptied_at": _BASE - timedelta(hours=18),
        "fill_level_pct": 80,
        "scatter_severity": 1,
    },
    "BIN-C14": {
        "id": "BIN-C14",
        "name": "Market",
        "lat": 6.9344,
        "lng": 79.8428,
        "last_emptied_at": _BASE - timedelta(hours=30),
        "fill_level_pct": 90,
        "scatter_severity": 2,
    },
}


def _serialize(bin_doc: dict[str, Any]) -> dict[str, Any]:
    out = dict(bin_doc)
    last = out.get("last_emptied_at")
    if isinstance(last, datetime):
        out["last_emptied_at"] = last.isoformat()
        out["hours_since_clean"] = round(
            (_now() - last).total_seconds() / 3600.0, 2
        )
    else:
        out["hours_since_clean"] = 0.0
    return out


def list_bins() -> list[dict[str, Any]]:
    return [_serialize(b) for b in _BINS.values()]


def get_bin(bin_id: str) -> dict[str, Any] | None:
    raw = _BINS.get(bin_id)
    return _serialize(raw) if raw else None


def hours_since_clean(bin_id: str) -> float:
    raw = _BINS.get(bin_id)
    if not raw:
        return 0.0
    last = raw.get("last_emptied_at")
    if not isinstance(last, datetime):
        return 0.0
    return (_now() - last).total_seconds() / 3600.0


def mark_emptied(bin_id: str) -> dict[str, Any] | None:
    raw = _BINS.get(bin_id)
    if not raw:
        return None
    raw["last_emptied_at"] = _now()
    return _serialize(raw)
