from datetime import datetime, timezone, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..schemas import AppointmentOut, QueueStateOut
from ..auth import require_role
from ..utils.websocket import ws_manager
from ..utils.sms_service import send_sms, sms_your_turn, sms_queue_update

router = APIRouter(prefix="/doctors", tags=["Doctors"])


@router.get("/my-schedule", response_model=List[AppointmentOut])
def get_todays_schedule(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("doctor")),
):
    """Get today's appointment schedule for the logged-in doctor."""
    doctor = db.query(models.Doctor).filter(
        models.Doctor.user_id == current_user.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    appointments = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.doctor_id == doctor.id,
            models.Appointment.appointment_time >= today_start,
            models.Appointment.appointment_time < today_end,
        )
        .order_by(
            # Critical first, then by queue position
            models.Appointment.priority_score.desc(),
            models.Appointment.queue_position.asc(),
        )
        .all()
    )
    return appointments


@router.post("/appointments/{appointment_id}/call-next")
async def call_next_patient(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("doctor")),
):
    """Mark an appointment as ACTIVE (patient is being seen now)."""
    doctor = db.query(models.Doctor).filter(
        models.Doctor.user_id == current_user.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    appointment = db.query(models.Appointment).filter(
        models.Appointment.id == appointment_id,
        models.Appointment.doctor_id == doctor.id,
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Set previous active appointment to completed if exists
    db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor.id,
        models.Appointment.status == models.AppointmentStatus.active,
    ).update({"status": models.AppointmentStatus.completed})

    appointment.status = models.AppointmentStatus.active

    # Update queue state
    queue_state = db.query(models.QueueState).filter(
        models.QueueState.doctor_id == doctor.id
    ).first()
    if queue_state:
        queue_state.current_patient_id = appointment.patient_id
        queue_state.waiting_count = max(0, (queue_state.waiting_count or 1) - 1)

    # Notify patient
    notif = models.Notification(
        user_id=appointment.patient_id,
        title="🩺 It's Your Turn!",
        message="The doctor is ready to see you now. Please proceed to the consultation room.",
        notification_type="success",
    )
    db.add(notif)
    db.commit()

    # ── SMS: "It's Your Turn!" to current patient ──────────────────────────────
    try:
        patient = db.query(models.User).filter(models.User.id == appointment.patient_id).first()
        doctor_user = db.query(models.User).filter(models.User.id == current_user.id).first()
        if patient and patient.phone:
            msg = sms_your_turn(
                patient_name=patient.full_name.split()[0],
                doctor_name=f"Dr. {doctor_user.full_name if doctor_user else 'Doctor'}",
            )
            send_sms(patient.phone, msg)
            print(f"[SMS] Your-Turn sent to {patient.full_name} ({patient.phone})")
    except Exception as e:
        print(f"[SMS-ERR] your_turn: {e}")

    # ── SMS: "You're Almost Next!" to patient at position #2 ─────────────────
    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        next_up = (
            db.query(models.Appointment)
            .filter(
                models.Appointment.doctor_id == doctor.id,
                models.Appointment.status == models.AppointmentStatus.scheduled,
                models.Appointment.appointment_time >= today_start,
            )
            .order_by(
                models.Appointment.priority_score.desc(),
                models.Appointment.queue_position.asc(),
            )
            .first()
        )
        if next_up:
            next_patient = db.query(models.User).filter(models.User.id == next_up.patient_id).first()
            if next_patient and next_patient.phone:
                wait_mins = next_up.predicted_wait_minutes or 15
                msg = (
                    f"SmartQueue Hospital\n"
                    f"Hi {next_patient.full_name.split()[0]}!\n"
                    f"You're UP NEXT! 🎉\n"
                    f"Dr. {doctor_user.full_name if doctor_user else 'Doctor'} will see you shortly.\n"
                    f"Estimated wait: ~{int(wait_mins)} min.\n"
                    f"Please be ready at the waiting area!"
                )
                send_sms(next_patient.phone, msg)
                print(f"[SMS] Almost-Next sent to {next_patient.full_name} ({next_patient.phone})")

                # Also add in-app notification
                notif2 = models.Notification(
                    user_id=next_up.patient_id,
                    title="⏰ You're Almost Next!",
                    message=f"Dr. {doctor_user.full_name if doctor_user else 'Doctor'} will see you very soon. Please be ready!",
                    notification_type="warning",
                )
                db.add(notif2)
                db.commit()

                # WebSocket alert to next patient
                await ws_manager.send_to_user(
                    next_up.patient_id,
                    {
                        "type": "almost_your_turn",
                        "appointment_id": next_up.id,
                        "message": "You're almost next! Please be ready.",
                        "wait_minutes": wait_mins,
                    },
                )
    except Exception as e:
        print(f"[SMS-ERR] almost_next: {e}")

    # Real-time notification to current patient
    await ws_manager.send_to_user(
        appointment.patient_id,
        {
            "type": "your_turn",
            "appointment_id": appointment_id,
            "message": "The doctor is ready for you!",
        },
    )

    # Broadcast queue change to department
    await ws_manager.broadcast_to_department(
        doctor.department_id,
        {
            "type": "queue_update",
            "doctor_id": doctor.id,
            "current_patient": appointment.patient.full_name if appointment.patient else "Patient",
            "waiting_count": queue_state.waiting_count if queue_state else 0,
        },
    )

    return {"message": "Patient called", "appointment_id": appointment_id}


@router.patch("/appointments/{appointment_id}/complete")
async def complete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("doctor")),
):
    """Mark an appointment as completed."""
    doctor = db.query(models.Doctor).filter(
        models.Doctor.user_id == current_user.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    appointment = db.query(models.Appointment).filter(
        models.Appointment.id == appointment_id,
        models.Appointment.doctor_id == doctor.id,
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appointment.status = models.AppointmentStatus.completed

    # Clear current patient from queue state
    queue_state = db.query(models.QueueState).filter(
        models.QueueState.doctor_id == doctor.id
    ).first()
    if queue_state:
        queue_state.current_patient_id = None

    # Notify patient
    notif = models.Notification(
        user_id=appointment.patient_id,
        title="Consultation Completed ✅",
        message="Your consultation has been completed. Thank you for visiting.",
        notification_type="info",
    )
    db.add(notif)
    db.commit()

    # ── SMS: Alert next waiting patient that consultation is done ─────────────
    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        upcoming = (
            db.query(models.Appointment)
            .filter(
                models.Appointment.doctor_id == doctor.id,
                models.Appointment.status == models.AppointmentStatus.scheduled,
                models.Appointment.appointment_time >= today_start,
            )
            .order_by(
                models.Appointment.priority_score.desc(),
                models.Appointment.queue_position.asc(),
            )
            .first()
        )
        if upcoming:
            upcoming_patient = db.query(models.User).filter(models.User.id == upcoming.patient_id).first()
            doctor_user = db.query(models.User).filter(models.User.id == current_user.id).first()
            if upcoming_patient and upcoming_patient.phone:
                wait = int(upcoming.predicted_wait_minutes or 5)
                msg = (
                    f"SmartQueue Hospital\n"
                    f"Hi {upcoming_patient.full_name.split()[0]}!\n"
                    f"Previous consultation is done.\n"
                    f"You are NEXT in queue!\n"
                    f"Dr. {doctor_user.full_name if doctor_user else 'Doctor'} is ready.\n"
                    f"Please proceed to the waiting area!"
                )
                send_sms(upcoming_patient.phone, msg)
                print(f"[SMS] Next-Up sent to {upcoming_patient.full_name} ({upcoming_patient.phone})")
    except Exception as e:
        print(f"[SMS-ERR] complete_next: {e}")

    await ws_manager.broadcast_to_department(
        doctor.department_id,
        {"type": "consultation_complete", "doctor_id": doctor.id, "appointment_id": appointment_id},
    )
    return {"message": "Appointment completed"}


@router.patch("/appointments/{appointment_id}/reject")
async def reject_appointment(
    appointment_id: int,
    reason: str = "Doctor unavailable",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("doctor")),
):
    """Reject an appointment."""
    doctor = db.query(models.Doctor).filter(
        models.Doctor.user_id == current_user.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    appointment = db.query(models.Appointment).filter(
        models.Appointment.id == appointment_id,
        models.Appointment.doctor_id == doctor.id,
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appointment.status = models.AppointmentStatus.rejected
    appointment.medical_notes = reason

    notif = models.Notification(
        user_id=appointment.patient_id,
        title="Appointment Rejected ⚠️",
        message=f"Your appointment has been rejected. Reason: {reason}. Please rebook.",
        notification_type="warning",
    )
    db.add(notif)
    db.commit()

    await ws_manager.send_to_user(
        appointment.patient_id,
        {"type": "appointment_rejected", "appointment_id": appointment_id, "reason": reason},
    )
    return {"message": "Appointment rejected"}


@router.patch("/availability")
def update_availability(
    is_available: bool,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("doctor")),
):
    """Toggle doctor availability status."""
    doctor = db.query(models.Doctor).filter(
        models.Doctor.user_id == current_user.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    doctor.is_available = is_available
    db.commit()
    return {"message": f"Availability set to {is_available}", "is_available": is_available}


@router.get("/queue-state", response_model=QueueStateOut)
def get_my_queue_state(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("doctor")),
):
    """Get the current queue state for this doctor."""
    doctor = db.query(models.Doctor).filter(
        models.Doctor.user_id == current_user.id
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    queue_state = db.query(models.QueueState).filter(
        models.QueueState.doctor_id == doctor.id
    ).first()
    if not queue_state:
        raise HTTPException(status_code=404, detail="No queue state found")
    return queue_state
