from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from typing import Optional
from ..database import get_db
from ..auth import get_current_user
from .. import models

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackCreate(BaseModel):
    appointment_id: int
    doctor_id: int
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


@router.post("/submit")
def submit_feedback(
    data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.UserRole.patient:
        raise HTTPException(status_code=403, detail="Only patients can submit feedback")
    # Check if already submitted
    existing = db.query(models.Feedback).filter(
        models.Feedback.appointment_id == data.appointment_id,
        models.Feedback.patient_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Feedback already submitted for this appointment")
    fb = models.Feedback(
        patient_id=current_user.id,
        doctor_id=data.doctor_id,
        appointment_id=data.appointment_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return {"message": "Feedback submitted successfully", "id": fb.id}


@router.get("/doctor/{doctor_id}")
def get_doctor_feedback(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    feedbacks = db.query(models.Feedback).filter(models.Feedback.doctor_id == doctor_id).all()
    avg = db.query(func.avg(models.Feedback.rating)).filter(models.Feedback.doctor_id == doctor_id).scalar()
    result = []
    for fb in feedbacks:
        patient = db.query(models.User).filter(models.User.id == fb.patient_id).first()
        result.append({
            "id": fb.id,
            "patient_name": patient.full_name if patient else "Anonymous",
            "rating": fb.rating,
            "comment": fb.comment,
            "created_at": fb.created_at.isoformat() if fb.created_at else None,
        })
    return {"avg_rating": round(avg, 1) if avg else 0, "total": len(feedbacks), "feedbacks": result}


@router.get("/my-feedback")
def get_my_feedback(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    feedbacks = db.query(models.Feedback).filter(models.Feedback.patient_id == current_user.id).all()
    return [
        {
            "id": f.id,
            "doctor_id": f.doctor_id,
            "appointment_id": f.appointment_id,
            "rating": f.rating,
            "comment": f.comment,
        }
        for f in feedbacks
    ]
