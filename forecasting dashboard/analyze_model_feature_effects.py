import json
import pickle
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.inspection import PartialDependenceDisplay


ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "trained_model.pkl"
FEATURES_PATH = ROOT / "model_features.pkl"
INPUT_PATH = ROOT / "input.json"
OUTPUT_PLOT = ROOT / "pdp_rainfall_temp.png"


def load_model_and_features():
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)

    with open(FEATURES_PATH, "rb") as f:
        features = pickle.load(f)

    return model, features


def build_reference_dataframe(features):
    if INPUT_PATH.exists():
        with open(INPUT_PATH, "r", encoding="utf-8") as f:
            rows = json.load(f)
        df = pd.DataFrame(rows)
    else:
        df = pd.DataFrame({col: 0.0 for col in features})

    for col in features:
        if col not in df.columns:
            df[col] = 0.0

    # Cast the numeric feature columns to float. sklearn PDPs reject integer arrays
    # for some features because they can be implicitly rounded.
    for col in ["Rainfall_mm", "Max_Temp_C", "Waste_Lag_1", "Waste_Lag_7", "Month"]:
        if col in df.columns:
            df[col] = df[col].astype(float)

    return df[features]


def print_tree_splits(model, target_features=("Rainfall_mm", "Max_Temp_C"), max_trees=10):
    booster = model.get_booster()
    dump = booster.get_dump(dump_format="text")
    print("\n=== XGBoost split conditions for Rainfall_mm and Max_Temp_C ===")
    found = False
    for tree_idx, tree_text in enumerate(dump[:max_trees], start=1):
        lines = [line.strip() for line in tree_text.splitlines() if any(f in line for f in target_features)]
        if not lines:
            continue
        found = True
        print(f"\nTree {tree_idx}:")
        for line in lines[:20]:
            print(line)

    if not found:
        print("No split on Rainfall_mm or Max_Temp_C in the first", max_trees, "trees.")
        print("Scanning all trees for the target features...")
        for tree_idx, tree_text in enumerate(dump, start=1):
            lines = [line.strip() for line in tree_text.splitlines() if any(f in line for f in target_features)]
            if lines:
                print(f"\nTree {tree_idx}:")
                for line in lines[:20]:
                    print(line)
                break


def plot_pdp(model, X, target_features=("Rainfall_mm", "Max_Temp_C"), output_path=OUTPUT_PLOT):
    display = PartialDependenceDisplay.from_estimator(
        model,
        X,
        features=list(target_features),
        kind="average",
        grid_resolution=50,
    )
    fig = display.figure_
    fig.suptitle("Partial Dependence for Rainfall_mm and Max_Temp_C", fontsize=12)
    fig.tight_layout()
    fig.savefig(output_path, dpi=200, bbox_inches="tight")
    print(f"\nSaved PDP plot to: {output_path}")


if __name__ == "__main__":
    model, features = load_model_and_features()
    X = build_reference_dataframe(features)

    print(f"Model type: {type(model).__module__}.{type(model).__name__}")
    print(f"Expected feature count: {len(features)}")
    print("Feature names:")
    for i, col in enumerate(features, start=1):
        print(f"  {i}. {col}")

    print_tree_splits(model)
    plot_pdp(model, X)
    print("\nAnalysis complete.")
