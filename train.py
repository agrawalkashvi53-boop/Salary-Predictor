"""Train the salary model and save it to model/salary_model.joblib.

Run:  python train.py
"""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import KFold, cross_val_predict, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures

BASE = Path(__file__).parent
DATA_PATH = BASE / "data" / "Salary.csv"
MODEL_PATH = BASE / "model" / "salary_model.joblib"


def main() -> None:
    df = pd.read_csv(DATA_PATH).dropna()
    X = df[["YearsExperience"]].to_numpy()
    y = df["Salary"].to_numpy()
    print(f"Loaded {len(df)} rows from {DATA_PATH.name}")

    # The dataset is tiny, so compare candidates with 5-fold cross-validation
    # instead of trusting a single train/test split.
    candidates = {
        "Linear regression": make_pipeline(LinearRegression()),
        "Polynomial (degree 2)": make_pipeline(PolynomialFeatures(2), LinearRegression()),
    }
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    scores = {}
    for name, model in candidates.items():
        pred = cross_val_predict(model, X, y, cv=kf)
        scores[name] = {
            "r2": r2_score(y, pred),
            "mae": mean_absolute_error(y, pred),
            "rmse": float(np.sqrt(np.mean((y - pred) ** 2))),
        }
        print(f"{name:24s} CV R2={scores[name]['r2']:.4f}  "
              f"MAE={scores[name]['mae']:.0f}  RMSE={scores[name]['rmse']:.0f}")

    # Prefer the simpler model unless the curve is clearly better.
    best = "Linear regression"
    if scores["Polynomial (degree 2)"]["r2"] > scores[best]["r2"] + 0.01:
        best = "Polynomial (degree 2)"
    print(f"Selected: {best}")

    # Hold-out check for a sanity-test number to show in the UI.
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    holdout = candidates[best].fit(X_tr, y_tr)
    holdout_r2 = r2_score(y_te, holdout.predict(X_te))
    print(f"Hold-out R2 (20% split): {holdout_r2:.4f}")

    # Final model trains on all data.
    final = candidates[best].fit(X, y)
    grid = np.linspace(X.min(), X.max(), 50).reshape(-1, 1)

    artifact = {
        "model": final,
        "name": best,
        "metrics": {**scores[best], "holdout_r2": holdout_r2},
        "n_samples": int(len(df)),
        "x_min": float(X.min()),
        "x_max": float(X.max()),
        "points": df.rename(columns={"YearsExperience": "x", "Salary": "y"})
                    .to_dict(orient="records"),
        "line": [{"x": float(a), "y": float(b)}
                 for a, b in zip(grid.ravel(), final.predict(grid))],
    }
    MODEL_PATH.parent.mkdir(exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
