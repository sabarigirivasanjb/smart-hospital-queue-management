"""
Emergency Triage AI Module
--------------------------
Computes an ESI (Emergency Severity Index) risk score from clinical inputs.
Uses a two-layer approach:
  1. Rule-based expert system (immediate critical flags)
  2. Decision Tree classifier trained on synthetic triage data
"""

import numpy as np
import joblib
import os
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import LabelEncoder
from ..schemas import TriageQuestionnaireRequest, PriorityLevel

MODEL_PATH = os.path.join(os.path.dirname(__file__), "triage_model.joblib")


def _build_feature_vector(req: TriageQuestionnaireRequest) -> np.ndarray:
    """Convert triage questionnaire into a numeric feature vector."""
    hr = req.heart_rate if req.heart_rate is not None else 80
    spo2 = req.oxygen_saturation if req.oxygen_saturation is not None else 98
    temp = req.temperature if req.temperature is not None else 37.0

    return np.array([[
        int(req.chest_pain),
        int(req.difficulty_breathing),
        int(req.high_fever),
        int(req.severe_bleeding),
        int(req.loss_of_consciousness),
        int(req.accident_trauma),
        int(req.stroke_symptoms),
        int(req.severe_abdominal_pain),
        int(req.allergic_reaction),
        hr,
        spo2,
        temp,
        req.pain_scale,
    ]])


def _rule_based_score(req: TriageQuestionnaireRequest) -> float:
    """
    Compute a raw risk score [0-100] using clinical rules.
    Based on Emergency Severity Index (ESI) guidelines.
    """
    score = 0.0

    # Immediate life-threatening flags (each adds up to 30 pts)
    if req.loss_of_consciousness:
        score += 30
    if req.chest_pain:
        score += 25
    if req.difficulty_breathing:
        score += 25
    if req.stroke_symptoms:
        score += 25
    if req.severe_bleeding:
        score += 20
    if req.accident_trauma:
        score += 15
    if req.allergic_reaction:
        score += 15
    if req.severe_abdominal_pain:
        score += 10
    if req.high_fever:
        score += 8

    # Pain scale contribution (0-10 mapped to 0-10 pts)
    score += req.pain_scale

    # Vitals risk (abnormal ranges add points)
    if req.heart_rate:
        if req.heart_rate > 120 or req.heart_rate < 50:
            score += 15
        elif req.heart_rate > 100 or req.heart_rate < 60:
            score += 5

    if req.oxygen_saturation:
        if req.oxygen_saturation < 90:
            score += 20
        elif req.oxygen_saturation < 94:
            score += 10

    if req.temperature:
        if req.temperature > 39.5 or req.temperature < 35.0:
            score += 10
        elif req.temperature > 38.5:
            score += 5

    return min(score, 100.0)


def _score_to_priority(score: float) -> PriorityLevel:
    if score >= 90:
        return PriorityLevel.critical
    elif score >= 70:
        return PriorityLevel.high
    elif score >= 40:
        return PriorityLevel.medium
    else:
        return PriorityLevel.normal


def _priority_message(level: PriorityLevel, score: float) -> str:
    messages = {
        PriorityLevel.critical: (
            f"🚨 CRITICAL — Risk Score: {score:.0f}/100. "
            "You have been moved to the FRONT of the queue. "
            "Medical staff have been alerted immediately."
        ),
        PriorityLevel.high: (
            f"⚠️ HIGH Priority — Risk Score: {score:.0f}/100. "
            "You will be seen very soon. Please stay near the waiting area."
        ),
        PriorityLevel.medium: (
            f"🟡 MEDIUM Priority — Risk Score: {score:.0f}/100. "
            "Your appointment has been prioritized over standard queue."
        ),
        PriorityLevel.normal: (
            f"✅ NORMAL — Risk Score: {score:.0f}/100. "
            "You are in the standard queue. Please wait for your turn."
        ),
    }
    return messages[level]


class TriageAI:
    """Emergency triage scoring engine."""

    def __init__(self):
        self.model: DecisionTreeClassifier = None
        self.label_encoder = LabelEncoder()
        self._load_or_train()

    def _load_or_train(self):
        if os.path.exists(MODEL_PATH):
            self.model = joblib.load(MODEL_PATH)
        else:
            self._train_model()

    def _train_model(self):
        """Train a Decision Tree on synthetic triage data."""
        rng = np.random.default_rng(42)
        n = 5000

        # Features: 9 binary symptoms + hr + spo2 + temp + pain_scale
        X = np.zeros((n, 13))
        y = []

        for i in range(n):
            # Random symptom pattern
            symptoms = rng.integers(0, 2, size=9)
            hr = int(rng.integers(40, 160))
            spo2 = int(rng.integers(82, 100))
            temp = round(float(rng.uniform(34.5, 40.5)), 1)
            pain = int(rng.integers(0, 11))

            X[i] = [*symptoms, hr, spo2, temp, pain]

            # Compute rule-based label for supervised training
            mock_req = TriageQuestionnaireRequest(
                chest_pain=bool(symptoms[0]),
                difficulty_breathing=bool(symptoms[1]),
                high_fever=bool(symptoms[2]),
                severe_bleeding=bool(symptoms[3]),
                loss_of_consciousness=bool(symptoms[4]),
                accident_trauma=bool(symptoms[5]),
                stroke_symptoms=bool(symptoms[6]),
                severe_abdominal_pain=bool(symptoms[7]),
                allergic_reaction=bool(symptoms[8]),
                heart_rate=hr,
                oxygen_saturation=spo2,
                temperature=temp,
                pain_scale=pain,
            )
            score = _rule_based_score(mock_req)
            label = _score_to_priority(score).value
            y.append(label)

        self.model = DecisionTreeClassifier(max_depth=10, random_state=42)
        self.model.fit(X, y)
        joblib.dump(self.model, MODEL_PATH)

    def assess(self, req: TriageQuestionnaireRequest) -> tuple[float, PriorityLevel, str]:
        """
        Returns (risk_score, priority_level, message).
        Uses rule-based score as primary and model as secondary validation.
        """
        score = _rule_based_score(req)

        # ML model cross-check
        if self.model is not None:
            features = _build_feature_vector(req)
            ml_label = self.model.predict(features)[0]
            ml_level = PriorityLevel(ml_label)
            rule_level = _score_to_priority(score)

            # Take the MORE conservative (higher priority) of the two
            priority_order = [
                PriorityLevel.normal,
                PriorityLevel.medium,
                PriorityLevel.high,
                PriorityLevel.critical,
            ]
            final_level = (
                ml_level
                if priority_order.index(ml_level) > priority_order.index(rule_level)
                else rule_level
            )
        else:
            final_level = _score_to_priority(score)

        message = _priority_message(final_level, score)
        return score, final_level, message


# Module-level singleton
triage_ai = TriageAI()
