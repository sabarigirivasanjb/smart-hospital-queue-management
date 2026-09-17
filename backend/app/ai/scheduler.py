"""
AI Appointment Scheduler
-------------------------
Recommends the best doctor + time slot for a patient based on:
  - Department selection
  - Active doctor availability
  - Current queue size per doctor
  - Doctor average consultation duration
  - Patient priority level
"""

from datetime import datetime, timedelta, timezone
from typing import List
from sqlalchemy.orm import Session
from .. import models
from ..schemas import SlotRecommendation
from .wait_time_model import wait_time_predictor


def recommend_slots(
    db: Session,
    department_id: int,
    preferred_time: datetime = None,
    priority_score: float = 0.0,
    top_n: int = 3,
) -> List[SlotRecommendation]:
    """
    Returns up to `top_n` recommended appointment slots for the given department.
    """
    now = datetime.now(timezone.utc)
    start_time = preferred_time or now

    # Fetch all available doctors in department
    doctors = (
        db.query(models.Doctor)
        .filter(
            models.Doctor.department_id == department_id,
            models.Doctor.is_available == True,
        )
        .all()
    )

    if not doctors:
        return []

    slots: List[SlotRecommendation] = []

    for doctor in doctors:
        # Count active/scheduled appointments today for this doctor
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        queue_count = (
            db.query(models.Appointment)
            .filter(
                models.Appointment.doctor_id == doctor.id,
                models.Appointment.status.in_(["scheduled", "active"]),
                models.Appointment.appointment_time >= today_start,
                models.Appointment.appointment_time < today_end,
            )
            .count()
        )

        # Skip fully booked doctors
        if queue_count >= doctor.max_daily_patients:
            continue

        # Estimate when the next free slot is
        # (queue_count * avg_consult_time) after the start_time
        minutes_until_free = queue_count * doctor.avg_consultation_minutes
        recommended_time = start_time + timedelta(minutes=minutes_until_free)

        # Predict wait time via ML model
        estimated_wait = wait_time_predictor.predict(
            queue_position=queue_count + 1,
            waiting_count=queue_count,
            avg_consult_time=doctor.avg_consultation_minutes,
            hour_of_day=recommended_time.hour,
            day_of_week=recommended_time.weekday(),
            priority_score=priority_score,
            doctor_count=len(doctors),
        )

        dept = db.query(models.Department).filter(
            models.Department.id == department_id
        ).first()

        reason = _build_reason(queue_count, doctor, priority_score)

        slots.append(
            SlotRecommendation(
                doctor_id=doctor.id,
                doctor_name=doctor.user.full_name if doctor.user else f"Doctor #{doctor.id}",
                department=dept.name if dept else "Unknown",
                specialization=doctor.specialization,
                recommended_time=recommended_time,
                current_queue_size=queue_count,
                estimated_wait_minutes=round(estimated_wait, 1),
                reason=reason,
            )
        )

    # Sort by estimated wait time (lowest first), then break ties with priority benefit
    slots.sort(key=lambda s: s.estimated_wait_minutes)
    return slots[:top_n]


def _build_reason(queue_count: int, doctor: models.Doctor, priority_score: float) -> str:
    parts = []
    if queue_count == 0:
        parts.append("Doctor is currently free")
    elif queue_count <= 3:
        parts.append(f"Short queue ({queue_count} patient(s))")
    else:
        parts.append(f"{queue_count} patients ahead")

    if priority_score >= 70:
        parts.append("your high priority will advance your position")

    if doctor.experience_years >= 10:
        parts.append(f"experienced specialist ({doctor.experience_years} yrs)")

    return "; ".join(parts) if parts else "Best available slot"
