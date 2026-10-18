#!/usr/bin/env python3
"""Time POST /predict (gateway) and optional fill-api directly.

Examples:
  python scripts/probe_predict_latency.py --image sample.jpg --url https://YOUR-backend.up.railway.app/predict --esp32-id esp-cam-1 --n 20
  python scripts/probe_predict_latency.py --image sample.jpg --url https://YOUR-fill-api.up.railway.app/predict --direct-fill --n 20
"""

from __future__ import annotations

import argparse
import csv
import statistics
import time
from pathlib import Path

import urllib.request


def post_multipart(url: str, image_path: Path, *, esp32_id: str | None, direct_fill: bool) -> tuple[int, float, int]:
    boundary = "----VwBoundary7MA4YWxkTrZu0gW"
    data = image_path.read_bytes()
    parts: list[bytes] = []

    def add_field(name: str, value: str) -> None:
        parts.append(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
                f"{value}\r\n"
            ).encode()
        )

    if not direct_fill:
        add_field("source_type", "esp32")
        if esp32_id:
            add_field("esp32_id", esp32_id)

    file_field = "file" if direct_fill else "image"
    parts.append(
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{file_field}"; filename="{image_path.name}"\r\n'
            f"Content-Type: image/jpeg\r\n\r\n"
        ).encode()
    )
    parts.append(data)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    body = b"".join(parts)

    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=180) as resp:
        payload = resp.read()
        status = resp.status
    dt = time.perf_counter() - t0
    return status, dt, len(payload)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--url", required=True)
    p.add_argument("--image", type=Path, required=True)
    p.add_argument("--esp32-id", default="esp-cam-latency")
    p.add_argument("--direct-fill", action="store_true")
    p.add_argument("--n", type=int, default=10)
    p.add_argument("--out", type=Path, default=Path("thesis_materials/latency/probe_predict_results.csv"))
    args = p.parse_args()

    if not args.image.is_file():
        print(f"Missing image: {args.image}")
        return 1

    rows = []
    times = []
    for i in range(1, args.n + 1):
        status, dt, nbytes = post_multipart(
            args.url, args.image, esp32_id=args.esp32_id, direct_fill=args.direct_fill
        )
        times.append(dt)
        rows.append({"trial": i, "status": status, "seconds": round(dt, 3), "response_bytes": nbytes})
        print(f"trial {i}: {dt:.3f}s status={status}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["trial", "status", "seconds", "response_bytes"])
        w.writeheader()
        w.writerows(rows)

    times_sorted = sorted(times)
    p95 = times_sorted[max(0, int(0.95 * len(times_sorted)) - 1)]
    print("---")
    print(f"n={len(times)} mean={statistics.mean(times):.3f}s median={statistics.median(times):.3f}s p95={p95:.3f}s")
    print(f"Wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
