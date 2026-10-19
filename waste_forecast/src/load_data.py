from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pandas as pd

# The forecasting target is the eight-council monthly aggregate. "other" is
# identical to the C & D category and is excluded. kdu-hospital and nd-akuregoda
# are excluded. The grand-total series was rejected because C & D first appears
# in 2023-10, producing a +32.5% month-on-month reporting break against +7.4%
# for the councils. This changes measured annual growth from +19.7%/+17.7% to
# +6.6%/+14.9%. kdu-campus has no rows before 2023-10, so 2023-01..2023-09 is
# really a seven-council sum; the estimated gap is 181.2 t, which is 0.205% of
# those months and 0.138% of the 36-month target, documented as negligible.
# Category shares excluding C & D reconcile with the eight-council target to
# +0.101% overall and within -0.004% to +0.233% per month; the residual is
# kdu-hospital plus nd-akuregoda, which the category table includes and the target
# excludes.
TARGET_LOCATION_IDS = {
    "dehiwala-mtlavinia",
    "moratuwa-mc",
    "kotte-mc",
    "maharagama-uc",
    "kesbewa-uc",
    "boralesgamuwa-uc",
    "homagama-ps",
    "kdu-campus",
}

# Shares WITHIN the eight-council target scope, derived from
# waste_forecast/data/location_monthly.csv (2023-01..2025-12, 394,563.2 t).
# These are shares of the EIGHT-COUNCIL target, not of the WPWMA grand total.
# They differ from grand-total shares because "other" (= the C & D category,
# 13.37% of the grand total) is excluded from the target.
# Previous hardcoded values, kept for traceability:
#   dehiwala 0.245, moratuwa 0.180, kotte 0.147, maharagama 0.131,
#   kesbewa 0.114, boralesgamuwa 0.090, homagama 0.061, kdu 0.032
INSTITUTE_SHARES = {
    "dehiwala-mtlavinia": 0.2876,
    "maharagama-uc":      0.1962,
    "kesbewa-uc":         0.1651,
    "moratuwa-mc":        0.1454,
    "kotte-mc":           0.0759,
    "boralesgamuwa-uc":   0.0755,
    "homagama-ps":        0.0529,
    "kdu-campus":         0.0014,
}

# Category shares with C & D REMOVED (not zeroed) and renormalised to 1.0,
# because "other" is identical to the C & D category and is outside the
# eight-council target. C & D was 60,936.5 t of the 455,898.9 t grand total.
# NOTE: the top category changes from Burnable to SOW.
# Previous hardcoded values: Burnable 0.385, SOW 0.320, ...
CATEGORY_SHARES = {
    "SOW":                   0.5460,
    "Burnable":              0.3291,
    "Unburnable":            0.0778,
    "Bulky Waste":           0.0346,
    "Slaughter House Waste": 0.0108,
    "Sanitary Waste":        0.0016,
    "Industrial Waste":      0.0001,
}

# Deprecated synthetic fallback: used only when the real location data is missing.
# Historical monthly waste totals (in metric tons) for Western Province / Colombo cluster (2023-2025)
DEFAULT_MONTHLY_WASTE = [
    {"year": 2023, "month": 1, "waste_tons": 28.5, "date": "2023-01-01"},
    {"year": 2023, "month": 2, "waste_tons": 27.2, "date": "2023-02-01"},
    {"year": 2023, "month": 3, "waste_tons": 29.1, "date": "2023-03-01"},
    {"year": 2023, "month": 4, "waste_tons": 31.4, "date": "2023-04-01"},
    {"year": 2023, "month": 5, "waste_tons": 28.9, "date": "2023-05-01"},
    {"year": 2023, "month": 6, "waste_tons": 27.8, "date": "2023-06-01"},
    {"year": 2023, "month": 7, "waste_tons": 28.3, "date": "2023-07-01"},
    {"year": 2023, "month": 8, "waste_tons": 29.0, "date": "2023-08-01"},
    {"year": 2023, "month": 9, "waste_tons": 28.1, "date": "2023-09-01"},
    {"year": 2023, "month": 10, "waste_tons": 28.6, "date": "2023-10-01"},
    {"year": 2023, "month": 11, "waste_tons": 27.9, "date": "2023-11-01"},
    {"year": 2023, "month": 12, "waste_tons": 33.2, "date": "2023-12-01"},
    {"year": 2024, "month": 1, "waste_tons": 29.0, "date": "2024-01-01"},
    {"year": 2024, "month": 2, "waste_tons": 27.8, "date": "2024-02-01"},
    {"year": 2024, "month": 3, "waste_tons": 29.5, "date": "2024-03-01"},
    {"year": 2024, "month": 4, "waste_tons": 32.1, "date": "2024-04-01"},
    {"year": 2024, "month": 5, "waste_tons": 29.3, "date": "2024-05-01"},
    {"year": 2024, "month": 6, "waste_tons": 28.4, "date": "2024-06-01"},
    {"year": 2024, "month": 7, "waste_tons": 28.9, "date": "2024-07-01"},
    {"year": 2024, "month": 8, "waste_tons": 29.6, "date": "2024-08-01"},
    {"year": 2024, "month": 9, "waste_tons": 28.7, "date": "2024-09-01"},
    {"year": 2024, "month": 10, "waste_tons": 29.1, "date": "2024-10-01"},
    {"year": 2024, "month": 11, "waste_tons": 28.5, "date": "2024-11-01"},
    {"year": 2024, "month": 12, "waste_tons": 34.0, "date": "2024-12-01"},
    {"year": 2025, "month": 1, "waste_tons": 29.4, "date": "2025-01-01"},
    {"year": 2025, "month": 2, "waste_tons": 28.2, "date": "2025-02-01"},
    {"year": 2025, "month": 3, "waste_tons": 30.0, "date": "2025-03-01"},
    {"year": 2025, "month": 4, "waste_tons": 32.8, "date": "2025-04-01"},
    {"year": 2025, "month": 5, "waste_tons": 29.8, "date": "2025-05-01"},
    {"year": 2025, "month": 6, "waste_tons": 28.9, "date": "2025-06-01"},
    {"year": 2025, "month": 7, "waste_tons": 29.4, "date": "2025-07-01"},
    {"year": 2025, "month": 8, "waste_tons": 30.1, "date": "2025-08-01"},
    {"year": 2025, "month": 9, "waste_tons": 29.2, "date": "2025-09-01"},
    {"year": 2025, "month": 10, "waste_tons": 29.7, "date": "2025-10-01"},
    {"year": 2025, "month": 11, "waste_tons": 29.0, "date": "2025-11-01"},
    {"year": 2025, "month": 12, "waste_tons": 34.5, "date": "2025-12-01"},
]


def load_waste_data(workspace_root: str | Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    data_path = Path(workspace_root) / "waste_forecast" / "data" / "location_monthly.csv"
    try:
        source = pd.read_csv(data_path)
    except FileNotFoundError:
        allow_synthetic = os.getenv("WASTE_ALLOW_SYNTHETIC_FALLBACK", "").lower() in {
            "1",
            "true",
            "yes",
        }
        if not allow_synthetic:
            raise FileNotFoundError(
                f"Real forecasting data is required but was not found at {data_path}. "
                "Set WASTE_ALLOW_SYNTHETIC_FALLBACK=true only for an explicit synthetic-data test."
            ) from None
        print(
            "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n"
            f"WARNING: real forecasting data missing at {data_path}\n"
            "WARNING: using deprecated synthetic DEFAULT_MONTHLY_WASTE fallback\n"
            "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
            file=sys.stderr,
        )
        df = pd.DataFrame(DEFAULT_MONTHLY_WASTE)
    else:
        source = source[source["location_id"].isin(TARGET_LOCATION_IDS)].copy()
        source["year"] = source["year"].astype("int64")
        source["month"] = source["month"].astype("int64")
        source["waste_tons"] = source["waste_tons"].astype("float64")
        source["date"] = pd.to_datetime(
            source["year"].astype(str)
            + "-"
            + source["month"].astype(str).str.zfill(2)
            + "-01"
        )
        df = (
            source.groupby(["year", "month", "date"], as_index=False)["waste_tons"]
            .sum()
            .sort_values(["year", "month"])
        )

    df["date"] = pd.to_datetime(df["date"])
    total_all = df[["year", "month", "waste_tons", "date"]].copy()
    waste_df = total_all.copy()
    print(
        f"[load_waste_data] source={data_path} rows={len(total_all)}",
        file=sys.stderr,
    )
    return waste_df, total_all


def compute_seasonal_insights() -> dict[str, object]:
    _, df = load_waste_data(Path(__file__).resolve().parents[2])
    monthly_avg = df.groupby("month")["waste_tons"].mean()
    peak_month_num = int(monthly_avg.idxmax())
    peak_month_name = pd.to_datetime(f"2025-{peak_month_num:02d}-01").strftime("%B")
    peak_avg_tons = float(monthly_avg.max())
    total_tons = float(df["waste_tons"].sum())

    sorted_cats = sorted(CATEGORY_SHARES.items(), key=lambda x: x[1], reverse=True)
    top1_cat, top1_pct = sorted_cats[0][0], round(sorted_cats[0][1] * 100, 1)
    top2_cat, top2_pct = sorted_cats[1][0], round(sorted_cats[1][1] * 100, 1)
    combined_pct = round(top1_pct + top2_pct, 1)

    DISPLAY_NAMES = {
        "dehiwala-mtlavinia": "Dehiwala - Mt Lavinia",
        "maharagama-uc":      "Maharagama U.C.",
        "kesbewa-uc":         "Kesbewa U.C.",
        "moratuwa-mc":        "Moratuwa M.C.",
        "kotte-mc":           "Sri Jayawardenepura Kotte M.C.",
        "boralesgamuwa-uc":   "Boralesgamuwa U.C.",
        "homagama-ps":        "Homagama P.S.",
        "kdu-campus":         "Kothalawala Defence University",
    }

    sorted_desc = sorted(INSTITUTE_SHARES.items(), key=lambda x: x[1], reverse=True)
    highest_id, highest_share = sorted_desc[0]
    second_id, second_share = sorted_desc[1]
    lowest_id, lowest_share = sorted_desc[-1]

    highest_name = DISPLAY_NAMES[highest_id]
    second_name = DISPLAY_NAMES[second_id]
    lowest_name = DISPLAY_NAMES[lowest_id]

    days_in_peak = 31
    lowest_kg_day = lowest_share * peak_avg_tons * 1000 / days_in_peak
    top_kg_day = highest_share * peak_avg_tons * 1000 / days_in_peak
    second_kg_day = second_share * peak_avg_tons * 1000 / days_in_peak
    lead_pct = (highest_share / second_share - 1) * 100

    return {
        "peakMonth": {
            "month": peak_month_name,
            "averageTonsPerMonth": round(peak_avg_tons, 1),
            "totalTonsCollected": round(total_tons, 1),
            "headline": f"{peak_month_name} is the Peak Month",
            "detail": (
                f"~{peak_avg_tons:,.1f} tons/month peak average "
                f"(~{total_tons:,.1f} tons collected across the eight configured "
                f"councils, 2023-2025)."
            ),
        },
        "dominantCategories": {
            "topCategory": top1_cat,
            "topPct": top1_pct,
            "secondCategory": top2_cat,
            "secondPct": top2_pct,
            "combinedPct": combined_pct,
            "headline": f"{top1_cat} ({top1_pct}%) & {top2_cat} ({top2_pct}%)",
            "detail": (
                f"Together they represent {combined_pct}% of waste collected "
                f"across the eight configured councils."
            ),
        },
        "lowestVolumeSite": {
            "siteId": lowest_id,
            "siteName": lowest_name,
            "sharePct": round(lowest_share * 100, 2),
            "headline": f"{lowest_name}",
            "detail": (
                f"Lowest volume site (~{lowest_share*100:.2f}% share, "
                f"~{lowest_kg_day:,.0f} KG/day in the peak month) - "
                f"campus-scale boundary vs municipal councils."
            ),
        },
        "decemberStandout": {
            "siteId": highest_id,
            "siteName": highest_name,
            "secondSiteName": second_name,
            "headline": f"{highest_name}",
            "detail": (
                f"Largest {peak_month_name} collection (~{top_kg_day:,.0f} KG/day), "
                f"outperforming next-highest {second_name} "
                f"(~{second_kg_day:,.0f} KG/day) by ~{lead_pct:.0f}%."
            ),
        },
    }
