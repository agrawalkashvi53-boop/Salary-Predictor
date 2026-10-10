"""Flask server: serves the web UI and a small JSON API.

Run:  python app.py   then open http://127.0.0.1:5000
"""
from pathlib import Path

import joblib
import numpy as np
from flask import Flask, jsonify, request, send_from_directory

BASE = Path(__file__).parent
MODEL_PATH = BASE / "model" / "salary_model.joblib"

if not MODEL_PATH.exists():
    raise SystemExit("Model not found. Run `python train.py` first.")

artifact = joblib.load(MODEL_PATH)
model = artifact["model"]
RMSE = artifact["metrics"]["rmse"]
MAX_YEARS = 50

app = Flask(__name__, static_folder="static", static_url_path="/static")


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/model-info")
def model_info():
    return jsonify({
        "name": artifact["name"],
        "metrics": artifact["metrics"],
        "n_samples": artifact["n_samples"],
        "x_min": artifact["x_min"],
        "x_max": artifact["x_max"],
        "points": artifact["points"],
        "line": artifact["line"],
    })


@app.post("/api/predict")
def predict():
    body = request.get_json(silent=True) or {}
    try:
        years = float(body.get("years"))
    except (TypeError, ValueError):
        return jsonify(error="Enter your years of experience as a number."), 400
    if not np.isfinite(years) or years < 0 or years > MAX_YEARS:
        return jsonify(error=f"Years of experience must be between 0 and {MAX_YEARS}."), 400

    salary = float(model.predict(np.array([[years]]))[0])
    margin = 1.96 * RMSE  # ~95% range based on cross-validated error
    return jsonify(
        years=years,
        salary=round(salary),
        low=round(max(salary - margin, 0)),
        high=round(salary + margin),
        outside_range=years < artifact["x_min"] or years > artifact["x_max"],
        data_range=[artifact["x_min"], artifact["x_max"]],
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
