from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── Enums ─────────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    patient = "patient"
    doctor = "doctor"
    admin = "admin"


class PriorityLevel(str, Enum):
    normal = "normal"
    medium = "medium"
    high = "high"
    critical = "critical"


class AppointmentStatus(str, Enum):
    scheduled = "scheduled"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"
    rejected = "rejected"


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.patient
    age: Optional[int] = None
    blood_group: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str]
    role: UserRole
    age: Optional[int]
    blood_group: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Department ────────────────────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    avg_consultation_minutes: float = 15.0


class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str]
    avg_consultation_minutes: float
    is_active: bool

    class Config:
        from_attributes = True


# ── Doctor ────────────────────────────────────────────────────────────────────

class DoctorCreate(BaseModel):
    user_id: int
    department_id: int
    specialization: Optional[str] = None
    max_daily_patients: int = 30
    avg_consultation_minutes: float = 15.0
    experience_years: int = 0


class DoctorOut(BaseModel):
    id: int
    user_id: int
    department_id: int
    specialization: Optional[str]
    max_daily_patients: int
    avg_consultation_minutes: float
    is_available: bool
    experience_years: int
    user: Optional[UserOut]
    department: Optional[DepartmentOut]

    class Config:
        from_attributes = True


# ── Appointment ───────────────────────────────────────────────────────────────

class AppointmentCreate(BaseModel):
    doctor_id: int
    appointment_time: datetime
    symptoms_description: Optional[str] = None


class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    appointment_time: datetime
    status: AppointmentStatus
    priority_score: float
    priority_level: PriorityLevel
    queue_position: Optional[int]
    predicted_wait_minutes: Optional[float]
    symptoms_description: Optional[str]
    created_at: datetime
    patient: Optional[UserOut]
    doctor: Optional[DoctorOut]

    class Config:
        from_attributes = True


# ── Triage ────────────────────────────────────────────────────────────────────

class TriageQuestionnaireRequest(BaseModel):
    appointment_id: Optional[int] = None
    chest_pain: bool = False
    difficulty_breathing: bool = False
    high_fever: bool = False
    severe_bleeding: bool = False
    loss_of_consciousness: bool = False
    accident_trauma: bool = False
    stroke_symptoms: bool = False
    severe_abdominal_pain: bool = False
    allergic_reaction: bool = False
    heart_rate: Optional[int] = None       # bpm
    oxygen_saturation: Optional[int] = None  # %
    temperature: Optional[float] = None    # Celsius
    pain_scale: int = Field(default=0, ge=0, le=10)
    additional_notes: Optional[str] = None


class TriageResult(BaseModel):
    risk_score: float
    priority_level: PriorityLevel
    message: str
    queue_position: Optional[int] = None
    predicted_wait_minutes: Optional[float] = None


# ── Queue ─────────────────────────────────────────────────────────────────────

class QueueStateOut(BaseModel):
    id: int
    department_id: int
    doctor_id: int
    current_patient_id: Optional[int]
    waiting_count: int
    avg_wait_time_predicted: float
    department: Optional[DepartmentOut]
    doctor: Optional[DoctorOut]

    class Config:
        from_attributes = True


class PatientQueueStatus(BaseModel):
    appointment_id: int
    queue_position: int
    patients_ahead: int
    predicted_wait_minutes: float
    priority_level: PriorityLevel
    status: AppointmentStatus


# ── Notification ──────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Analytics ─────────────────────────────────────────────────────────────────

class DepartmentStats(BaseModel):
    department_name: str
    total_patients: int
    avg_wait_time: float
    emergency_count: int
    completed_count: int


class HospitalAnalytics(BaseModel):
    total_patients_today: int
    total_appointments_today: int
    avg_wait_time_overall: float
    emergency_cases_today: int
    completed_consultations_today: int
    active_doctors: int
    department_stats: List[DepartmentStats]


# ── Scheduler ─────────────────────────────────────────────────────────────────

class SlotRecommendation(BaseModel):
    doctor_id: int
    doctor_name: str
    department: str
    specialization: Optional[str]
    recommended_time: datetime
    current_queue_size: int
    estimated_wait_minutes: float
    reason: str


class SchedulerRequest(BaseModel):
    department_id: int
    preferred_time: Optional[datetime] = None
    symptoms_description: Optional[str] = None
