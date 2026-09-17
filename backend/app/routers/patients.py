import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..schemas import (
    AppointmentCreate, AppointmentOut, TriageQuestionnaireRequest,
    TriageResult, PatientQueueStatus, NotificationOut, SlotRecommendation,
    SchedulerRequest
)
from ..auth import get_current_user, require_role
from ..ai.triage_ai import triage_ai
from ..ai.wait_time_model import wait_time_predictor
from ..ai.scheduler import recommend_slots
from ..utils.websocket import ws_manager

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("/appointments", response_model=List[AppointmentOut])
def get_my_appointments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("patient")),
):
    """Get all appointments for the current patient."""
    appointments = (
        db.query(models.Appointment)
        .filter(models.Appointment.patient_id == current_user.id)
        .order_by(models.Appointment.appointment_time.desc())
        .all()
    )
    return appointments


@router.post("/appointments", response_model=AppointmentOut, status_code=201)
async def book_appointment(
    appointment_data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("patient")),
):
    """Book an appointment with AI scheduling assistance."""
    doctor = db.query(models.Doctor).filter(
        models.Doctor.id == appointment_data.doctor_id
    ).first()
    if not doctor or not doctor.is_available:
        raise HTTPException(status_code=404, detail="Doctor not found or unavailable")

    # Determine queue position
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
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
    queue_position = queue_count + 1

    # Predict wait time
    now = datetime.now(timezone.utc)
    predicted_wait = wait_time_predictor.predict(
        queue_position=queue_position,
        waiting_count=queue_count,
        avg_consult_time=doctor.avg_consultation_minutes,
        hour_of_day=now.hour,
        day_of_week=now.weekday(),
        priority_score=0.0,
        doctor_count=1,
    )

    appointment = models.Appointment(
        patient_id=current_user.id,
        doctor_id=doctor.id,
        appointment_time=appointment_data.appointment_time,
        status=models.AppointmentStatus.scheduled,
        priority_score=0.0,
        priority_level=models.PriorityLevel.normal,
        queue_position=queue_position,
        predicted_wait_minutes=predicted_wait,
        symptoms_description=appointment_data.symptoms_description,
    )
    db.add(appointment)

    # Update queue state
    queue_state = db.query(models.QueueState).filter(
        models.QueueState.doctor_id == doctor.id
    ).first()
    if queue_state:
        queue_state.waiting_count = queue_position
        queue_state.avg_wait_time_predicted = predicted_wait
    else:
        new_qs = models.QueueState(
            department_id=doctor.department_id,
            doctor_id=doctor.id,
            waiting_count=queue_position,
            avg_wait_time_predicted=predicted_wait,
        )
        db.add(new_qs)

    # Send confirmation notification
    notification = models.Notification(
        user_id=current_user.id,
        title="Appointment Confirmed ✅",
        message=(
            f"Your appointment with Dr. {doctor.user.full_name if doctor.user else 'the doctor'} "
            f"is confirmed. Queue position: #{queue_position}. "
            f"Estimated wait: {predicted_wait:.0f} minutes."
        ),
        notification_type="success",
    )
    db.add(notification)
    db.commit()
    db.refresh(appointment)

    # Broadcast queue update via WebSocket
    await ws_manager.broadcast_to_department(
        doctor.department_id,
        {
            "type": "queue_update",
            "doctor_id": doctor.id,
            "waiting_count": queue_position,
            "avg_wait_minutes": predicted_wait,
        },
    )
    return appointment


@router.get("/appointments/{appointment_id}/queue-status", response_model=PatientQueueStatus)
def get_queue_status(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("patient")),
):
    """Get live queue position and estimated wait time — priority-aware."""
    appointment = db.query(models.Appointment).filter(
        models.Appointment.id == appointment_id,
        models.Appointment.patient_id == current_user.id,
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Get all active/scheduled appointments for this doctor today, ordered by priority
    all_queue = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.doctor_id == appointment.doctor_id,
            models.Appointment.status.in_(["scheduled", "active"]),
            models.Appointment.appointment_time >= today_start,
        )
        .order_by(
            models.Appointment.priority_score.desc(),   # CRITICAL first
            models.Appointment.appointment_time.asc(),  # then by arrival time
        )
        .all()
    )

    # Find this patient's real position in priority-sorted queue
    real_position = 1
    ahead_count = 0
    for idx, appt in enumerate(all_queue):
        if appt.id == appointment_id:
            real_position = idx + 1
            ahead_count = idx
            break

    doctor = db.query(models.Doctor).filter(
        models.Doctor.id == appointment.doctor_id
    ).first()

    now = datetime.now(timezone.utc)
    predicted_wait = wait_time_predictor.predict(
        queue_position=real_position,
        waiting_count=ahead_count + 1,
        avg_consult_time=doctor.avg_consultation_minutes if doctor else 15,
        hour_of_day=now.hour,
        day_of_week=now.weekday(),
        priority_score=appointment.priority_score,
        doctor_count=1,
    )

    return PatientQueueStatus(
        appointment_id=appointment_id,
        queue_position=real_position,
        patients_ahead=ahead_count,
        predicted_wait_minutes=predicted_wait,
        priority_level=appointment.priority_level,
        status=appointment.status,
    )


@router.post("/triage/{appointment_id}", response_model=TriageResult)
async def submit_triage(
    appointment_id: int,
    triage_data: TriageQuestionnaireRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("patient")),
):
    """
    Submit emergency triage questionnaire.
    Critical patients are immediately moved to the front of the queue.
    """
    appointment = db.query(models.Appointment).filter(
        models.Appointment.id == appointment_id,
        models.Appointment.patient_id == current_user.id,
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    risk_score, priority_level, message = triage_ai.assess(triage_data)

    # Update appointment priority
    appointment.priority_score = risk_score
    appointment.priority_level = priority_level

    # Save triage record first
    triage_record = models.EmergencyTriage(
        patient_id=current_user.id,
        appointment_id=appointment_id,
        responses_json=json.dumps(triage_data.model_dump()),
        risk_score=risk_score,
        priority_level=priority_level,
    )
    db.add(triage_record)
    db.flush()  # flush so priority_score is set before we re-sort

    # ── RECALCULATE ALL queue positions for this doctor (priority-aware) ──
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    all_queue = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.doctor_id == appointment.doctor_id,
            models.Appointment.status.in_(["scheduled", "active"]),
            models.Appointment.appointment_time >= today_start,
        )
        .order_by(
            models.Appointment.priority_score.desc(),   # CRITICAL first
            models.Appointment.appointment_time.asc(),  # then arrival time
        )
        .all()
    )
    for idx, appt in enumerate(all_queue):
        appt.queue_position = idx + 1  # 1-indexed

    # If CRITICAL: send emergency alert to doctor's department
    if priority_level == models.PriorityLevel.critical:
        doctor_obj = db.query(models.Doctor).filter(
            models.Doctor.id == appointment.doctor_id
        ).first()
        if doctor_obj:
            import asyncio
            try:
                asyncio.get_event_loop().run_until_complete(
                    ws_manager.broadcast_to_department(
                        doctor_obj.department_id,
                        {
                            "type": "emergency_alert",
                            "patient_name": current_user.full_name,
                            "patient_id": current_user.id,
                            "appointment_id": appointment_id,
                            "risk_score": risk_score,
                            "priority_level": priority_level.value,
                            "message": f"🚨 CRITICAL patient {current_user.full_name} needs immediate attention!",
                        },
                    )
                )
            except Exception:
                pass
        notification = models.Notification(
            user_id=current_user.id,
            title="🚨 Critical Priority Assigned",
            message=message,
            notification_type="emergency",
        )
        db.add(notification)

    db.commit()
    db.refresh(appointment)

    now = datetime.now(timezone.utc)
    doctor = db.query(models.Doctor).filter(
        models.Doctor.id == appointment.doctor_id
    ).first()
    predicted_wait = wait_time_predictor.predict(
        queue_position=appointment.queue_position or 1,
        waiting_count=max((appointment.queue_position or 1) - 1, 0),
        avg_consult_time=doctor.avg_consultation_minutes if doctor else 15,
        hour_of_day=now.hour,
        day_of_week=now.weekday(),
        priority_score=risk_score,
        doctor_count=1,
    )

    return TriageResult(
        risk_score=risk_score,
        priority_level=priority_level,
        message=message,
        queue_position=appointment.queue_position,
        predicted_wait_minutes=predicted_wait,
    )


@router.get("/scheduler/recommend", response_model=List[SlotRecommendation])
def get_slot_recommendations(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("patient")),
):
    """Get AI-recommended appointment slots for a department."""
    slots = recommend_slots(db, department_id)
    if not slots:
        raise HTTPException(status_code=404, detail="No available slots in this department")
    return slots


@router.get("/notifications", response_model=List[NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("patient")),
):
    """Get all notifications for the current patient."""
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(50)
        .all()
    )


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mark a notification as read."""
    notif = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"message": "Marked as read"}
