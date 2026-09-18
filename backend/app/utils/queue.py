from datetime import datetime

from sqlalchemy.orm import Session

from .. import models


def refresh_doctor_queue(
    db: Session,
    doctor_id: int,
    day_start: datetime,
    day_end: datetime,
) -> list[models.Appointment]:
    """Rebuild queue positions from the current priority and arrival order."""
    appointments = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.doctor_id == doctor_id,
            models.Appointment.status.in_(
                [models.AppointmentStatus.scheduled, models.AppointmentStatus.active]
            ),
            models.Appointment.appointment_time >= day_start,
            models.Appointment.appointment_time < day_end,
        )
        .order_by(
            models.Appointment.priority_score.desc(),
            models.Appointment.appointment_time.asc(),
            models.Appointment.id.asc(),
        )
        .all()
    )

    for position, appointment in enumerate(appointments, start=1):
        appointment.queue_position = position

    queue_state = db.query(models.QueueState).filter(
        models.QueueState.doctor_id == doctor_id
    ).first()
    if queue_state:
        queue_state.waiting_count = sum(
            appointment.status == models.AppointmentStatus.scheduled
            for appointment in appointments
        )

    return appointments