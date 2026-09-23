from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from ..database import get_db
from .. import models
from ..auth import require_role

router = APIRouter(prefix="/reception", tags=["Reception"])


def require_reception(current_user=Depends(require_role("reception"))):
    return current_user


# ── Helper ─────────────────────────────────────────────────────────────────────
def today_range():
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start, end


def appt_dict(a, db):
    patient = db.query(models.User).filter(models.User.id == a.patient_id).first()
    doc_profile = db.query(models.Doctor).filter(models.Doctor.id == a.doctor_id).first()
    doctor_user = db.query(models.User).filter(models.User.id == doc_profile.user_id).first() if doc_profile else None
    dept = db.query(models.Department).filter(models.Department.id == doc_profile.department_id).first() if doc_profile else None
    checkin = db.query(models.CheckIn).filter(models.CheckIn.appointment_id == a.id).first()
    bill = db.query(models.Bill).filter(models.Bill.appointment_id == a.id).first()
    return {
        "id": a.id,
        "appointment_time": a.appointment_time.isoformat() if a.appointment_time else None,
        "status": a.status.value if a.status else a.status,
        "priority_level": a.priority_level.value if a.priority_level else "normal",
        "priority_score": a.priority_score,
        "queue_position": a.queue_position,
        "predicted_wait_minutes": a.predicted_wait_minutes,
        "patient_id": a.patient_id,
        "patient_name": patient.full_name if patient else "",
        "patient_phone": patient.phone if patient else "",
        "patient_age": patient.age if patient else None,
        "patient_blood_group": patient.blood_group if patient else None,
        "doctor_id": a.doctor_id,
        "doctor_name": doctor_user.full_name if doctor_user else "",
        "department": dept.name if dept else "",
        "department_id": dept.id if dept else None,
        "checked_in": checkin is not None,
        "checked_in_at": checkin.checked_in_at.isoformat() if checkin else None,
        "checked_out_at": checkin.checked_out_at.isoformat() if checkin and checkin.checked_out_at else None,
        "checkin_status": checkin.status if checkin else None,
        "bill_id": bill.id if bill else None,
        "bill_number": bill.bill_number if bill else None,
        "bill_total": bill.total_amount if bill else None,
        "bill_status": bill.payment_status if bill else None,
    }


# ── Dashboard Summary ──────────────────────────────────────────────────────────
@router.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("reception")),
):
    start, end = today_range()

    today_apts = db.query(models.Appointment).filter(
        models.Appointment.appointment_time >= start,
        models.Appointment.appointment_time < end,
    ).all()

    today_ids = [a.id for a in today_apts]

    checked_in_count = db.query(models.CheckIn).filter(
        models.CheckIn.appointment_id.in_(today_ids)
    ).count()

    waiting = sum(1 for a in today_apts if a.status.value == "scheduled")
    completed = sum(1 for a in today_apts if a.status.value == "completed")
    active = sum(1 for a in today_apts if a.status.value == "active")

    # Bills
    today_bills = db.query(models.Bill).filter(
        models.Bill.appointment_id.in_(today_ids)
    ).all()

    paid_bills = [b for b in today_bills if b.payment_status == "paid"]
    pending_bills = [b for b in today_bills if b.payment_status == "pending"]
    today_collection = sum(b.total_amount for b in paid_bills)
    pending_amount = sum(b.total_amount for b in pending_bills)

    # Department-wise collection
    dept_collection = {}
    for bill in paid_bills:
        doc = db.query(models.Doctor).filter(models.Doctor.id == bill.doctor_id).first()
        dept = db.query(models.Department).filter(models.Department.id == doc.department_id).first() if doc else None
        dept_name = dept.name if dept else "Other"
        dept_collection[dept_name] = dept_collection.get(dept_name, 0) + bill.total_amount

    return {
        "total_appointments": len(today_apts),
        "checked_in": checked_in_count,
        "waiting": waiting,
        "active": active,
        "completed": completed,
        "pending_payments": len(pending_bills),
        "today_collection": today_collection,
        "pending_amount": pending_amount,
        "paid_bills": len(paid_bills),
        "total_bills": len(today_bills),
        "dept_collection": dept_collection,
    }


# ── Today's Appointments ───────────────────────────────────────────────────────
@router.get("/appointments")
def get_today_appointments(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("reception")),
):
    start, end = today_range()
    query = db.query(models.Appointment).filter(
        models.Appointment.appointment_time >= start,
        models.Appointment.appointment_time < end,
    ).order_by(
        models.Appointment.priority_score.desc(),
        models.Appointment.appointment_time.asc(),
    )
    apts = query.all()
    result = [appt_dict(a, db) for a in apts]

    if search:
        s = search.lower()
        result = [
            r for r in result if
            s in r["patient_name"].lower() or
            s in str(r["patient_id"]) or
            s in str(r["id"]) or
            (r["bill_number"] and s in r["bill_number"].lower())
        ]
    return result


# ── Patient Check-in ───────────────────────────────────────────────────────────
@router.post("/checkin/{appointment_id}")
def checkin_patient(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("reception")),
):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    existing = db.query(models.CheckIn).filter(models.CheckIn.appointment_id == appointment_id).first()
    if existing:
        return {"message": "Already checked in", "checkin_id": existing.id, "checked_in_at": existing.checked_in_at.isoformat()}

    checkin = models.CheckIn(
        appointment_id=appointment_id,
        patient_id=appt.patient_id,
        checked_in_by=current_user.id,
        status="checked_in",
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return {"message": "Patient checked in successfully", "checkin_id": checkin.id, "checked_in_at": checkin.checked_in_at.isoformat()}


# ── Patient Check-out ─────────────────────────────────────────────────────────
@router.post("/checkout/{appointment_id}")
def checkout_patient(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("reception")),
):
    checkin = db.query(models.CheckIn).filter(models.CheckIn.appointment_id == appointment_id).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Patient not checked in")

    checkin.checked_out_at = datetime.now(timezone.utc)
    checkin.status = "checked_out"
    db.commit()
    return {"message": "Patient checked out", "checked_out_at": checkin.checked_out_at.isoformat()}


# ── Live Queue (reuse existing) ────────────────────────────────────────────────
@router.get("/queue")
def get_live_queue(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("reception")),
):
    start, end = today_range()
    apts = db.query(models.Appointment).filter(
        models.Appointment.appointment_time >= start,
        models.Appointment.appointment_time < end,
        models.Appointment.status.in_(["scheduled", "active"]),
    ).order_by(
        models.Appointment.priority_score.desc(),
        models.Appointment.queue_position.asc(),
    ).all()
    return [appt_dict(a, db) for a in apts]


# ── Bills (view only) ─────────────────────────────────────────────────────────
@router.get("/bills")
def get_bills(
    status: Optional[str] = None,
    date: Optional[str] = None,
    department: Optional[str] = None,
    payment_method: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("reception")),
):
    start, end = today_range()

    # Default: today's bills
    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            start = d
            end = d + timedelta(days=1)
        except:
            pass

    apt_ids_today = [
        a.id for a in db.query(models.Appointment).filter(
            models.Appointment.appointment_time >= start,
            models.Appointment.appointment_time < end,
        ).all()
    ]

    bills_q = db.query(models.Bill).filter(models.Bill.appointment_id.in_(apt_ids_today))
    if status:
        bills_q = bills_q.filter(models.Bill.payment_status == status)
    if payment_method:
        bills_q = bills_q.filter(models.Bill.payment_method == payment_method)

    bills = bills_q.order_by(models.Bill.created_at.desc()).all()

    result = []
    for b in bills:
        patient = db.query(models.User).filter(models.User.id == b.patient_id).first()
        doc = db.query(models.Doctor).filter(models.Doctor.id == b.doctor_id).first()
        doctor_user = db.query(models.User).filter(models.User.id == doc.user_id).first() if doc else None
        dept = db.query(models.Department).filter(models.Department.id == doc.department_id).first() if doc else None
        appt = db.query(models.Appointment).filter(models.Appointment.id == b.appointment_id).first()

        if department and (not dept or dept.name != department):
            continue

        result.append({
            "id": b.id,
            "bill_number": b.bill_number,
            "appointment_id": b.appointment_id,
            "appointment_time": appt.appointment_time.isoformat() if appt else None,
            "patient_id": b.patient_id,
            "patient_name": patient.full_name if patient else "",
            "patient_phone": patient.phone if patient else "",
            "patient_age": patient.age if patient else None,
            "doctor_name": doctor_user.full_name if doctor_user else "",
            "department": dept.name if dept else "",
            "department_id": dept.id if dept else None,
            "consultation_fee": b.consultation_fee,
            "medicine_charges": b.medicine_charges,
            "lab_charges": b.lab_charges,
            "other_charges": b.other_charges,
            "discount": b.discount,
            "total_amount": b.total_amount,
            "payment_status": b.payment_status,
            "payment_method": b.payment_method,
            "diagnosis": b.diagnosis,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        })
    return result


# ── Collect Payment ────────────────────────────────────────────────────────────
class PaymentIn(BaseModel):
    payment_method: str  # cash, upi, card
    transaction_ref: Optional[str] = None


@router.put("/bills/{bill_id}/collect")
def collect_payment(
    bill_id: int,
    data: PaymentIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("reception")),
):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Bill already paid")

    bill.payment_status = "paid"
    bill.payment_method = data.payment_method
    if data.transaction_ref:
        bill.notes = (bill.notes or "") + f" | TxnRef: {data.transaction_ref}"
    db.commit()
    db.refresh(bill)

    patient = db.query(models.User).filter(models.User.id == bill.patient_id).first()
    doc = db.query(models.Doctor).filter(models.Doctor.id == bill.doctor_id).first()
    dept = db.query(models.Department).filter(models.Department.id == doc.department_id).first() if doc else None
    appt = db.query(models.Appointment).filter(models.Appointment.id == bill.appointment_id).first()
    doctor_user = db.query(models.User).filter(models.User.id == doc.user_id).first() if doc else None

    return {
        "message": "Payment collected successfully",
        "receipt": {
            "bill_number": bill.bill_number,
            "patient_name": patient.full_name if patient else "",
            "patient_id": bill.patient_id,
            "patient_phone": patient.phone if patient else "",
            "department": dept.name if dept else "",
            "doctor_name": doctor_user.full_name if doctor_user else "",
            "appointment_time": appt.appointment_time.isoformat() if appt else None,
            "consultation_fee": bill.consultation_fee,
            "medicine_charges": bill.medicine_charges,
            "lab_charges": bill.lab_charges,
            "other_charges": bill.other_charges,
            "discount": bill.discount,
            "total_amount": bill.total_amount,
            "amount_paid": bill.total_amount,
            "payment_method": bill.payment_method,
            "payment_status": "paid",
            "transaction_ref": data.transaction_ref,
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "notes": bill.notes,
        }
    }


# ── Receipt (re-fetch) ────────────────────────────────────────────────────────
@router.get("/bills/{bill_id}/receipt")
def get_receipt(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("reception")),
):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    patient = db.query(models.User).filter(models.User.id == bill.patient_id).first()
    doc = db.query(models.Doctor).filter(models.Doctor.id == bill.doctor_id).first()
    dept = db.query(models.Department).filter(models.Department.id == doc.department_id).first() if doc else None
    appt = db.query(models.Appointment).filter(models.Appointment.id == bill.appointment_id).first()
    doctor_user = db.query(models.User).filter(models.User.id == doc.user_id).first() if doc else None

    return {
        "bill_number": bill.bill_number,
        "patient_name": patient.full_name if patient else "",
        "patient_id": bill.patient_id,
        "patient_phone": patient.phone if patient else "",
        "patient_age": patient.age if patient else None,
        "patient_blood_group": patient.blood_group if patient else None,
        "department": dept.name if dept else "",
        "doctor_name": doctor_user.full_name if doctor_user else "",
        "appointment_time": appt.appointment_time.isoformat() if appt else None,
        "consultation_fee": bill.consultation_fee,
        "medicine_charges": bill.medicine_charges,
        "lab_charges": bill.lab_charges,
        "other_charges": bill.other_charges,
        "discount": bill.discount,
        "total_amount": bill.total_amount,
        "amount_paid": bill.total_amount if bill.payment_status == "paid" else 0,
        "payment_method": bill.payment_method,
        "payment_status": bill.payment_status,
        "notes": bill.notes,
        "created_at": bill.created_at.isoformat() if bill.created_at else None,
    }


# ── Reports / Dept-wise collection ────────────────────────────────────────────
@router.get("/reports")
def get_reports(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("reception")),
):
    start, end = today_range()
    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            start = d; end = d + timedelta(days=1)
        except:
            pass

    apt_ids = [a.id for a in db.query(models.Appointment).filter(
        models.Appointment.appointment_time >= start,
        models.Appointment.appointment_time < end,
    ).all()]

    all_bills = db.query(models.Bill).filter(models.Bill.appointment_id.in_(apt_ids)).all()
    paid = [b for b in all_bills if b.payment_status == "paid"]
    pending = [b for b in all_bills if b.payment_status != "paid"]

    # Dept-wise
    depts = db.query(models.Department).all()
    dept_data = []
    for dept in depts:
        dept_bills = []
        for b in all_bills:
            doc = db.query(models.Doctor).filter(models.Doctor.id == b.doctor_id).first()
            if doc and doc.department_id == dept.id:
                dept_bills.append(b)
        paid_dept = [b for b in dept_bills if b.payment_status == "paid"]
        pending_dept = [b for b in dept_bills if b.payment_status != "paid"]
        dept_data.append({
            "department": dept.name,
            "total_bills": len(dept_bills),
            "paid_bills": len(paid_dept),
            "pending_bills": len(pending_dept),
            "collection": sum(b.total_amount for b in paid_dept),
            "pending_amount": sum(b.total_amount for b in pending_dept),
        })

    return {
        "date": start.date().isoformat(),
        "total_collection": sum(b.total_amount for b in paid),
        "pending_amount": sum(b.total_amount for b in pending),
        "total_bills": len(all_bills),
        "paid_bills": len(paid),
        "pending_bills": len(pending),
        "by_method": {
            "cash": sum(b.total_amount for b in paid if b.payment_method == "cash"),
            "upi": sum(b.total_amount for b in paid if b.payment_method == "upi"),
            "card": sum(b.total_amount for b in paid if b.payment_method == "card"),
        },
        "departments": dept_data,
    }
