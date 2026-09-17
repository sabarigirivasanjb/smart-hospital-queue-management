"""
Queue Wait Time Prediction Model
----------------------------------
Predicts patient waiting time (in minutes) using a Random Forest Regressor.

Features:
  - queue_position     : Patient's position in queue (1-based)
  - waiting_count      : Total waiting patients in dept
  - avg_consult_time   : Doctor's average consultation duration (min)
  - hour_of_day        : 0-23
  - day_of_week        : 0=Mon … 6=Sun
  - priority_score     : Triage risk score 0-100
  - doctor_count       : Active doctors in the department
"""

import numpy as np
import joblib
import os
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

MODEL_PATH = os.path.join(os.path.dirname(__file__), "wait_time_model.joblib")


def _generate_synthetic_data(n: int = 30_000) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(123)

    queue_pos = rng.integers(1, 40, size=n).astype(float)
    waiting_count = queue_pos + rng.integers(0, 10, size=n)
    avg_consult = rng.uniform(8, 30, size=n)
    hour = rng.integers(8, 20, size=n).astype(float)
    day = rng.integers(0, 7, size=n).astype(float)
    priority = rng.uniform(0, 100, size=n)
    doc_count = rng.integers(1, 6, size=n).astype(float)

    # Ground-truth formula with noise
    base_wait = (queue_pos / doc_count) * avg_consult
    # Priority reduces wait for critical patients
    priority_reduction = (priority / 100) * 0.6 * base_wait
    peak_factor = np.where((hour >= 9) & (hour <= 12), 1.3, 1.0)
    noise = rng.normal(0, 3, size=n)

    y = np.clip(base_wait * peak_factor - priority_reduction + noise, 0, 300)

    X = np.column_stack([
        queue_pos, waiting_count, avg_consult, hour, day, priority, doc_count
    ])
    return X, y


class WaitTimePredictor:
    """Predicts patient wait time in minutes using Random Forest."""

    def __init__(self):
        self.model: RandomForestRegressor = None
        self._load_or_train()

    def _load_or_train(self):
        if os.path.exists(MODEL_PATH):
            self.model = joblib.load(MODEL_PATH)
        else:
            self._train()

    def _train(self):
        print("[WaitTimePredictor] Training Random Forest on synthetic data...")
        X, y = _generate_synthetic_data(30_000)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=12,
            n_jobs=-1,
            random_state=42,
        )
        self.model.fit(X_train, y_train)
        preds = self.model.predict(X_test)
        mae = mean_absolute_error(y_test, preds)
        print(f"[WaitTimePredictor] MAE on test set: {mae:.2f} minutes")
        joblib.dump(self.model, MODEL_PATH)

    def predict(
        self,
        queue_position: int,
        waiting_count: int,
        avg_consult_time: float,
        hour_of_day: int,
        day_of_week: int,
        priority_score: float = 0.0,
        doctor_count: int = 1,
    ) -> float:
        """Returns predicted waiting time in minutes (>= 0)."""
        if self.model is None:
            # Fallback linear estimate
            return max(0.0, (queue_position / max(doctor_count, 1)) * avg_consult_time)

        features = np.array([[
            queue_position,
            waiting_count,
            avg_consult_time,
            hour_of_day,
            day_of_week,
            priority_score,
            doctor_count,
        ]])
        result = self.model.predict(features)[0]
        return max(0.0, round(float(result), 1))


# Module-level singleton
wait_time_predictor = WaitTimePredictor()
