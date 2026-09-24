import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from .. import models
from ..schemas import (
    DepartmentCreate, DepartmentOut, DoctorCreate, DoctorOut,
    QueueStateOut, HospitalAnalytics, DepartmentStats, UserCreate,
    DoctorStaffCreate, ReceptionistCreate, StaffCredentialResponse,
    ReceptionistOut
)
from ..auth import require_role, hash_password


def _generate_staff_password(role_name: str) -> str:
    suffix = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
    return f"{role_name}@{suffix}"

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard", response_model=HospitalAnalytics)
def get_hospital_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    """Get hospital-wide analytics for the admin dashboard."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    total_today = db.query(models.Appointment).filter(
        models.Appointment.appointment_time >= today_start,
        models.Appointment.appointment_time < today_end,
    ).count()

    completed_today = db.query(models.Appointment).filter(
        models.Appointment.appointment_time >= today_start,
        models.Appointment.appointment_time < today_end,
        models.Appointment.status == models.AppointmentStatus.completed,
    ).count()

    emergency_today = db.query(models.EmergencyTriage).filter(
        models.EmergencyTriage.assessed_at >= today_start,
        models.EmergencyTriage.assessed_at < today_end,
        models.EmergencyTriage.priority_level == models.PriorityLevel.critical,
    ).count()

    avg_wait_result = db.query(func.avg(models.Appointment.predicted_wait_minutes)).filter(
        models.Appointment.appointment_time >= today_start,
        models.Appointment.predicted_wait_minutes.isnot(None),
    ).scalar()
    avg_wait = float(avg_wait_result or 0)

    active_doctors = db.query(models.Doctor).filter(
        models.Doctor.is_available == True
    ).count()

    total_patients = db.query(models.User).filter(
        models.User.role == models.UserRole.patient
    ).count()

    # Per-department stats
    departments = db.query(models.Department).all()
    dept_stats = []
    for dept in departments:
        dept_total = db.query(models.Appointment).join(models.Doctor).filter(
            models.Doctor.department_id == dept.id,
            models.Appointment.appointment_time >= today_start,
            models.Appointment.appointment_time < today_end,
        ).count()

        dept_completed = db.query(models.Appointment).join(models.Doctor).filter(
            models.Doctor.department_id == dept.id,
            models.Appointment.status == models.AppointmentStatus.completed,
            models.Appointment.appointment_time >= today_start,
        ).count()

        dept_emergency = db.query(models.EmergencyTriage).join(
            models.Appointment, models.EmergencyTriage.appointment_id == models.Appointment.id
        ).join(models.Doctor).filter(
            models.Doctor.department_id == dept.id,
            models.EmergencyTriage.priority_level == models.PriorityLevel.critical,
        ).count()

        dept_avg_wait = db.query(func.avg(models.Appointment.predicted_wait_minutes)).join(
            models.Doctor
        ).filter(
            models.Doctor.department_id == dept.id,
            models.Appointment.appointment_time >= today_start,
        ).scalar()

        dept_stats.append(DepartmentStats(
            department_name=dept.name,
            total_patients=dept_total,
            avg_wait_time=float(dept_avg_wait or 0),
            emergency_count=dept_emergency,
            completed_count=dept_completed,
        ))

    return HospitalAnalytics(
        total_patients_today=total_today,
        total_appointments_today=total_today,
        avg_wait_time_overall=avg_wait,
        emergency_cases_today=emergency_today,
        completed_consultations_today=completed_today,
        active_doctors=active_doctors,
        department_stats=dept_stats,
    )


@router.get("/queue-overview", response_model=List[QueueStateOut])
def get_all_queue_states(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    """Get real-time queue states for all doctors."""
    return db.query(models.QueueState).all()


@router.get("/departments", response_model=List[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    return db.query(models.Department).all()


@router.post("/departments", response_model=DepartmentOut, status_code=201)
def create_department(
    dept_data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    """Add a new hospital department."""
    existing = db.query(models.Department).filter(
        models.Department.code == dept_data.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department code already exists")

    dept = models.Department(**dept_data.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.patch("/departments/{dept_id}/toggle")
def toggle_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    """Toggle department active/inactive status."""
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    dept.is_active = not dept.is_active
    db.commit()
    db.refresh(dept)
    return {"id": dept.id, "name": dept.name, "is_active": dept.is_active}


@router.patch("/departments/{dept_id}")
def update_department(
    dept_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    """Update department name, description, avg_consultation_minutes."""
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for key in ["name", "description", "avg_consultation_minutes"]:
        if key in data:
            setattr(dept, key, data[key])
    db.commit()
    db.refresh(dept)
    return {"id": dept.id, "name": dept.name, "code": dept.code,
            "description": dept.description, "is_active": dept.is_active}


@router.get("/doctors", response_model=List[DoctorOut])
def list_doctors(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    return db.query(models.Doctor).all()


@router.post("/doctors/create", response_model=StaffCredentialResponse, status_code=201)
def create_doctor_account(
    doctor_data: DoctorStaffCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    """Create a doctor user and profile from the admin portal."""
    email = doctor_data.email.lower().strip()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    dept = db.query(models.Department).filter(models.Department.id == doctor_data.department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    generated_password = doctor_data.password or _generate_staff_password("Doctor")

    user = models.User(
        email=email,
        password_hash=hash_password(generated_password),
        full_name=doctor_data.full_name,
        phone=doctor_data.phone,
        role=models.UserRole.doctor,
    )
    db.add(user)
    db.flush()

    doctor = models.Doctor(
        user_id=user.id,
        department_id=doctor_data.department_id,
        specialization=doctor_data.specialization,
        max_daily_patients=doctor_data.max_daily_patients,
        avg_consultation_minutes=doctor_data.avg_consultation_minutes,
        experience_years=doctor_data.experience_years,
        is_available=True,
    )
    db.add(doctor)
    db.flush()

    queue_state = models.QueueState(
        department_id=doctor_data.department_id,
        doctor_id=doctor.id,
        waiting_count=0,
        avg_wait_time_predicted=0.0,
        is_active=True,
    )
    db.add(queue_state)
    db.commit()

    return StaffCredentialResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role="doctor",
        generated_password=generated_password,
    )


@router.post("/doctors", response_model=DoctorOut, status_code=201)
def add_doctor(
    doctor_data: DoctorCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    """Backward-compatible admin doctor profile assignment."""
    user = db.query(models.User).filter(
        models.User.id == doctor_data.user_id,
        models.User.role == models.UserRole.doctor,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Doctor user not found or wrong role")

    dept = db.query(models.Department).filter(
        models.Department.id == doctor_data.department_id
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    existing_profile = db.query(models.Doctor).filter(
        models.Doctor.user_id == doctor_data.user_id
    ).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="Doctor profile already exists for this user")

    doctor = models.Doctor(**doctor_data.model_dump())
    db.add(doctor)
    db.flush()

    qs = models.QueueState(
        department_id=doctor.department_id,
        doctor_id=doctor.id,
        waiting_count=0,
        avg_wait_time_predicted=0.0,
        is_active=True,
    )
    db.add(qs)
    db.commit()
    db.refresh(doctor)
    return doctor


@router.get("/receptionists", response_model=List[ReceptionistOut])
def list_receptionists(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    return db.query(models.User).filter(models.User.role == models.UserRole.reception).all()


@router.post("/receptionists", response_model=StaffCredentialResponse, status_code=201)
def create_receptionist_account(
    receptionist_data: ReceptionistCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    """Create a receptionist account from the admin portal."""
    email = receptionist_data.email.lower().strip()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    generated_password = receptionist_data.password or _generate_staff_password("Reception")
    user = models.User(
        email=email,
        password_hash=hash_password(generated_password),
        full_name=receptionist_data.full_name,
        phone=receptionist_data.phone,
        role=models.UserRole.reception,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return StaffCredentialResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role="reception",
        generated_password=generated_password,
    )


@router.get("/patients", response_model=List)
def list_all_patients(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    """Get all registered patients."""
    patients = db.query(models.User).filter(
        models.User.role == models.UserRole.patient
    ).all()
    return [
        {
            "id": p.id,
            "full_name": p.full_name,
            "email": p.email,
            "phone": p.phone,
            "age": p.age,
            "blood_group": p.blood_group,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in patients
    ]


@router.get("/emergency-alerts")
def get_emergency_alerts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    """Get all critical/high priority triage records from today."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    records = (
        db.query(models.EmergencyTriage)
        .filter(
            models.EmergencyTriage.assessed_at >= today_start,
            models.EmergencyTriage.priority_level.in_([
                models.PriorityLevel.critical, models.PriorityLevel.high
            ]),
        )
        .order_by(models.EmergencyTriage.risk_score.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "patient_id": r.patient_id,
            "patient_name": r.patient.full_name if r.patient else "Unknown",
            "risk_score": r.risk_score,
            "priority_level": r.priority_level.value,
            "assessed_at": r.assessed_at.isoformat(),
        }
        for r in records
    ]
