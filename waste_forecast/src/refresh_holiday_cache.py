"""Refresh the Sri Lanka holiday cache from Calendarific.

Extracted from the archived Dash prototype (forecasting dashboard/app.py): only
the Calendarific fetch and the cache write, no UI.

The cache is the file calendar_features.py reads (forecasting dashboard/holiday_cache.json),
in the same schema:

    {"2026": [{"name": str, "iso_date": "YYYY-MM-DD", "primary_type": str}, ...], ...}

Requested years are re-fetched and replaced; years not requested are kept as they
are. If any requested year fails, nothing is written.

Usage (from the repo root):
    python waste_forecast/src/refresh_holiday_cache.py --years 2026 2027 2028 --dry-run
    python waste_forecast/src/refresh_holiday_cache.py --years 2028

CALENDARIFIC_API_KEY must be set in the environment. If python-dotenv is installed,
forecasting dashboard/.env is loaded first (it never overrides an existing variable).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from calendar_features import get_holiday_cache_path

CALENDARIFIC_URL = "https://calendarific.com/api/v2/holidays"
COUNTRY = "LK"
DOTENV_PATH = Path(__file__).resolve().parents[2] / "forecasting dashboard" / ".env"


def get_api_key() -> str:
    try:
        from dotenv import load_dotenv  # optional

        load_dotenv(DOTENV_PATH, override=False)
    except ImportError:
        pass
    key = os.environ.get("CALENDARIFIC_API_KEY", "").strip()
    if not key:
        sys.exit(
            "ERROR: CALENDARIFIC_API_KEY is not set. Set it in the environment "
            f"(or in {DOTENV_PATH} with python-dotenv installed). No key, no refresh."
        )
    return key


def fetch_year(year: int, api_key: str) -> list[dict[str, str]]:
    query = urllib.parse.urlencode({"api_key": api_key, "country": COUNTRY, "year": year})
    try:
        with urllib.request.urlopen(f"{CALENDARIFIC_URL}?{query}", timeout=20) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as ex:
        body = ex.read().decode("utf-8", "replace")[:300].replace(api_key, "<key>")
        raise RuntimeError(f"Calendarific HTTP {ex.code} for {year}: {body}") from None
    except urllib.error.URLError as ex:
        raise RuntimeError(f"Calendarific request failed for {year}: {ex.reason}") from None

    meta_code = (payload.get("meta") or {}).get("code")
    if meta_code != 200:
        raise RuntimeError(f"Calendarific meta code {meta_code} for {year}: {str(payload.get('meta'))[:300]}")

    records = []
    for h in (payload.get("response") or {}).get("holidays") or []:
        name = str(h.get("name", "")).strip()
        iso_date = str((h.get("date") or {}).get("iso", "")).strip()
        types = h.get("type") or []
        if not name or not iso_date:
            continue  # same rule as app.py: rows without a name or date are dropped
        records.append({"name": name, "iso_date": iso_date, "primary_type": str(types[0]) if types else "Unknown"})

    if not records:
        raise RuntimeError(f"Calendarific returned no holidays for {year}; refusing to replace the cache entry.")
    bad = [r for r in records if not r["iso_date"].startswith(str(year))]
    if bad:
        raise RuntimeError(f"{len(bad)} holidays for {year} have dates outside {year}, e.g. {bad[0]}")
    return records


def describe_changes(year: str, old: list[dict], new: list[dict]) -> list[str]:
    key = lambda r: (r["iso_date"][:10], r["name"])
    old_map, new_map = {key(r): r for r in old}, {key(r): r for r in new}
    added = sorted(set(new_map) - set(old_map))
    removed = sorted(set(old_map) - set(new_map))
    retyped = sorted(k for k in set(old_map) & set(new_map) if old_map[k]["primary_type"] != new_map[k]["primary_type"])
    status = "new year" if not old else ("unchanged" if not (added or removed or retyped) else "changed")
    lines = [f"{year}: {len(old)} -> {len(new)} entries ({status})"]
    lines += [f"  + {d}  {n}  [{new_map[(d, n)]['primary_type']}]" for d, n in added]
    lines += [f"  - {d}  {n}  [{old_map[(d, n)]['primary_type']}]" for d, n in removed]
    lines += [f"  ~ {d}  {n}  [{old_map[(d, n)]['primary_type']} -> {new_map[(d, n)]['primary_type']}]" for d, n in retyped]
    return lines


def main() -> None:
    this_year = date.today().year
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", type=int, nargs="+", default=[this_year, this_year + 1],
                        help=f"years to fetch (default: {this_year} {this_year + 1})")
    parser.add_argument("--cache", type=Path, default=get_holiday_cache_path(),
                        help="cache file to update (default: the file calendar_features.py reads)")
    parser.add_argument("--dry-run", action="store_true", help="fetch and report changes without writing")
    args = parser.parse_args()

    cache = json.loads(args.cache.read_text(encoding="utf-8")) if args.cache.exists() else {}
    api_key = get_api_key()

    updated = dict(cache)
    report = []
    for year in sorted(set(args.years)):
        try:
            records = fetch_year(year, api_key)
        except RuntimeError as ex:
            sys.exit(f"ERROR: {ex}\nNothing was written.")
        report += describe_changes(str(year), cache.get(str(year), []), records)
        updated[str(year)] = records

    print(f"Cache: {args.cache}")
    print(f"Years in cache before: {sorted(cache)}  after: {sorted(updated, key=int)}")
    print("\n".join(report))

    if args.dry_run:
        print("Dry run: nothing written.")
        return
    payload = {y: updated[y] for y in sorted(updated, key=int)}
    tmp = args.cache.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(args.cache)
    print(f"Wrote {args.cache}")


if __name__ == "__main__":
    main()
