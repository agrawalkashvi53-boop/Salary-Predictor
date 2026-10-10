# Salary Predictor

Predicts salary from years of experience using scikit-learn, served by Flask with a responsive web UI.

## Run it

```bash
# 1. Go into the project folder
cd salary-predictor

# 2. (Recommended) create a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Train the model (creates model/salary_model.joblib)
python train.py

# 5. Start the app
python app.py
```

Open http://127.0.0.1:5000 in your browser.

## Project layout

- `data/Salary.csv`: training data (YearsExperience, Salary)
- `train.py`: compares linear and polynomial regression with cross-validation, saves the best
- `app.py`: Flask server with `GET /api/model-info` and `POST /api/predict`
- `static/`: the frontend (`index.html`, `style.css`, `app.js`)

## Customising

- Currency symbol: change `CURRENCY` at the top of `static/app.js`.
- New data: replace `data/Salary.csv` (same two columns) and re-run `python train.py`.
- Port: edit the last line of `app.py`.
