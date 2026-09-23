from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class UserRole(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    admin = "admin"
    reception = "reception"


class PriorityLevel(str, enum.Enum):
    normal = "normal"
    medium = "medium"
    high = "high"
    critical = "critical"


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    role = Column(SAEnum(UserRole), default=UserRole.patient, nullable=False)
    age = Column(Integer, nullable=True)
    blood_group = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    patient_appointments = relationship(
        "Appointment", foreign_keys="Appointment.patient_id", back_populates="patient"
    )
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")
    triage_records = relationship("EmergencyTriage", back_populates="patient")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    code = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    avg_consultation_minutes = Column(Float, default=15.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    doctors = relationship("Doctor", back_populates="department")
    queue_states = relationship("QueueState", back_populates="department")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    specialization = Column(String, nullable=True)
    max_daily_patients = Column(Integer, default=30)
    avg_consultation_minutes = Column(Float, default=15.0)
    is_available = Column(Boolean, default=True)
    experience_years = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="doctor_profile")
    department = relationship("Department", back_populates="doctors")
    appointments = relationship(
        "Appointment", foreign_keys="Appointment.doctor_id", back_populates="doctor"
    )
    queue_states = relationship("QueueState", back_populates="doctor")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    appointment_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(SAEnum(AppointmentStatus), default=AppointmentStatus.scheduled)
    priority_score = Column(Float, default=0.0)
    priority_level = Column(SAEnum(PriorityLevel), default=PriorityLevel.normal)
    queue_position = Column(Integer, nullable=True)
    predicted_wait_minutes = Column(Float, nullable=True)
    actual_wait_minutes = Column(Float, nullable=True)
    consultation_duration_minutes = Column(Float, nullable=True)
    symptoms_description = Column(Text, nullable=True)
    medical_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    patient = relationship(
        "User", foreign_keys=[patient_id], back_populates="patient_appointments"
    )
    doctor = relationship(
        "Doctor", foreign_keys=[doctor_id], back_populates="appointments"
    )


class EmergencyTriage(Base):
    __tablename__ = "emergency_triage"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    responses_json = Column(Text, nullable=False)  # JSON string of questionnaire answers
    risk_score = Column(Float, nullable=False)
    priority_level = Column(SAEnum(PriorityLevel), nullable=False)
    assessed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    patient = relationship("User", back_populates="triage_records")


class QueueState(Base):
    __tablename__ = "queue_states"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    current_patient_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    waiting_count = Column(Integer, default=0)
    avg_wait_time_predicted = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    department = relationship("Department", back_populates="queue_states")
    doctor = relationship("Doctor", back_populates="queue_states")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String, default="info")  # info, warning, emergency, success
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="notifications")


class MedicalReport(Base):
    __tablename__ = "medical_reports"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    report_type = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_number = Column(String, unique=True, nullable=False)  # e.g. BILL-2026-0001
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    consultation_fee = Column(Float, default=500.0)
    medicine_charges = Column(Float, default=0.0)
    lab_charges = Column(Float, default=0.0)
    other_charges = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    payment_status = Column(String, default="pending")  # pending, paid
    payment_method = Column(String, nullable=True)  # cash, card, upi
    diagnosis = Column(Text, nullable=True)
    prescription = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    generated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("Doctor", foreign_keys=[doctor_id])


class CheckIn(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    checked_in_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # reception staff user id
    checked_in_at = Column(DateTime(timezone=True), server_default=func.now())
    checked_out_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="checked_in")  # checked_in, checked_out
    notes = Column(Text, nullable=True)
