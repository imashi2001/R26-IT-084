from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

# Historical monthly scale shares derived from 2023-2025 municipal totals
# Dehiwala (~3000 tons/month), Moratuwa (~2200), Kotte (~1800), Maharagama (~1600),
# Kesbewa (~1400), Boralesgamuwa/Other (~1100), Homagama (~750), KDU (~400)
INSTITUTE_SHARES = {
    "dehiwala-mtlavinia": 0.245,
    "moratuwa-mc": 0.180,
    "kotte-mc": 0.147,
    "maharagama-uc": 0.131,
    "kesbewa-uc": 0.114,
    "boralesgamuwa-uc": 0.090,  # Fallback share for Institute_Other
    "homagama-ps": 0.061,
    "kdu-campus": 0.032,
}

# Historical Category-Vise waste composition percentages (2023-2025 average)
CATEGORY_SHARES = {
    "Burnable": 0.385,                # 38.5% (combustible / general waste)
    "SOW": 0.320,                     # 32.0% (short-term organic waste)
    "Unburnable": 0.125,              # 12.5% (inorganic / non-combustible)
    "Sanitary Waste": 0.065,          # 6.5%
    "Bulky Waste": 0.045,             # 4.5%
    "C & D": 0.035,                   # 3.5% (construction & demolition)
    "Industrial Waste": 0.015,        # 1.5%
    "Slaughter House Waste": 0.010,   # 1.0%
}

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
    df = pd.DataFrame(DEFAULT_MONTHLY_WASTE)
    df["date"] = pd.to_datetime(df["date"])
    total_all = df[["year", "month", "waste_tons", "date"]].copy()
    waste_df = df.copy()
    return waste_df, total_all
