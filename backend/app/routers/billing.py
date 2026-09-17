from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from ..database import get_db
from ..auth import get_current_user
from .. import models

router = APIRouter(prefix="/billing", tags=["billing"])


class BillCreate(BaseModel):
    appointment_id: int
    consultation_fee: float = 500.0
    medicine_charges: float = 0.0
    lab_charges: float = 0.0
    other_charges: float = 0.0
    discount: float = 0.0
    diagnosis: Optional[str] = None
    prescription: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = "cash"


class BillPayUpdate(BaseModel):
    payment_status: str = "paid"
    payment_method: Optional[str] = "cash"


def bill_to_dict(bill: models.Bill, db: Session) -> dict:
    appt = db.query(models.Appointment).filter(models.Appointment.id == bill.appointment_id).first()
    patient = db.query(models.User).filter(models.User.id == bill.patient_id).first()
    doc_profile = db.query(models.Doctor).filter(models.Doctor.id == bill.doctor_id).first()
    doctor_user = db.query(models.User).filter(models.User.id == doc_profile.user_id).first() if doc_profile else None
    dept = db.query(models.Department).filter(models.Department.id == doc_profile.department_id).first() if doc_profile else None

    return {
        "id": bill.id,
        "bill_number": bill.bill_number,
        "appointment_id": bill.appointment_id,
        "patient_id": bill.patient_id,
        "patient_name": patient.full_name if patient else "",
        "patient_email": patient.email if patient else "",
        "patient_phone": patient.phone if patient else "",
        "patient_age": patient.age if patient else None,
        "patient_blood_group": patient.blood_group if patient else None,
        "doctor_id": bill.doctor_id,
        "doctor_name": doctor_user.full_name if doctor_user else "",
        "doctor_specialization": doc_profile.specialization if doc_profile else "",
        "department": dept.name if dept else "",
        "appointment_time": appt.appointment_time.isoformat() if appt else None,
        "consultation_fee": bill.consultation_fee,
        "medicine_charges": bill.medicine_charges,
        "lab_charges": bill.lab_charges,
        "other_charges": bill.other_charges,
        "discount": bill.discount,
        "total_amount": bill.total_amount,
        "payment_status": bill.payment_status,
        "payment_method": bill.payment_method,
        "diagnosis": bill.diagnosis,
        "prescription": bill.prescription,
        "notes": bill.notes,
        "created_at": bill.created_at.isoformat() if bill.created_at else None,
    }


@router.post("/generate")
def generate_bill(
    data: BillCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in [models.UserRole.doctor, models.UserRole.admin]:
        raise HTTPException(status_code=403, detail="Only doctors or admins can generate bills")

    appt = db.query(models.Appointment).filter(models.Appointment.id == data.appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Check if bill already exists for this appointment
    existing = db.query(models.Bill).filter(models.Bill.appointment_id == data.appointment_id).first()
    if existing:
        return bill_to_dict(existing, db)

    # Auto-generate bill number
    year = datetime.now().year
    count = db.query(func.count(models.Bill.id)).scalar() or 0
    bill_number = f"BILL-{year}-{str(count + 1).zfill(4)}"

    total = data.consultation_fee + data.medicine_charges + data.lab_charges + data.other_charges - data.discount

    bill = models.Bill(
        bill_number=bill_number,
        appointment_id=data.appointment_id,
        patient_id=appt.patient_id,
        doctor_id=appt.doctor_id,
        consultation_fee=data.consultation_fee,
        medicine_charges=data.medicine_charges,
        lab_charges=data.lab_charges,
        other_charges=data.other_charges,
        discount=data.discount,
        total_amount=total,
        payment_status="pending",
        payment_method=data.payment_method,
        diagnosis=data.diagnosis,
        prescription=data.prescription,
        notes=data.notes,
        generated_by=current_user.id,
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill_to_dict(bill, db)


@router.get("/my-bills")
def get_my_bills(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bills = db.query(models.Bill).filter(models.Bill.patient_id == current_user.id).order_by(models.Bill.created_at.desc()).all()
    return [bill_to_dict(b, db) for b in bills]


@router.get("/patient/{patient_id}")
def get_patient_bills(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == models.UserRole.patient and current_user.id != patient_id:
        raise HTTPException(status_code=403, detail="Access denied")
    bills = db.query(models.Bill).filter(models.Bill.patient_id == patient_id).order_by(models.Bill.created_at.desc()).all()
    return [bill_to_dict(b, db) for b in bills]


@router.get("/{bill_id}")
def get_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill_to_dict(bill, db)


@router.put("/{bill_id}/pay")
def mark_paid(
    bill_id: int,
    data: BillPayUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    bill.payment_status = data.payment_status
    bill.payment_method = data.payment_method
    db.commit()
    db.refresh(bill)
    return bill_to_dict(bill, db)
