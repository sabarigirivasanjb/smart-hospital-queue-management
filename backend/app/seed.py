"""
Database seeding — creates default departments, doctors, and admin user on first run.
"""
from datetime import datetime, timezone, timedelta
import random
from sqlalchemy.orm import Session
from . import models
from .auth import hash_password


DEPARTMENTS = [
    {"name": "Cardiology", "code": "CARD", "description": "Heart and cardiovascular diseases", "avg_consultation_minutes": 20},
    {"name": "Emergency", "code": "EMRG", "description": "Emergency and trauma care", "avg_consultation_minutes": 25},
    {"name": "Neurology", "code": "NEUR", "description": "Brain and nervous system", "avg_consultation_minutes": 25},
    {"name": "Orthopedics", "code": "ORTH", "description": "Bones and joints", "avg_consultation_minutes": 18},
    {"name": "General Medicine", "code": "GENM", "description": "General health and primary care", "avg_consultation_minutes": 12},
    {"name": "Pediatrics", "code": "PEDI", "description": "Children's health", "avg_consultation_minutes": 15},
    {"name": "Dermatology", "code": "DERM", "description": "Skin conditions", "avg_consultation_minutes": 12},
    {"name": "Ophthalmology", "code": "OPHT", "description": "Eye care", "avg_consultation_minutes": 15},
]

DOCTORS_DATA = [
    {"name": "Dr. Arjun Ramesh", "email": "arjun.ramesh@hospital.com", "dept_code": "CARD", "spec": "Interventional Cardiologist", "exp": 15},
    {"name": "Dr. Priya Nair", "email": "priya.nair@hospital.com", "dept_code": "CARD", "spec": "Cardiac Surgeon", "exp": 12},
    {"name": "Dr. Suresh Kumar", "email": "suresh.kumar@hospital.com", "dept_code": "EMRG", "spec": "Emergency Medicine", "exp": 10},
    {"name": "Dr. Meena Krishnan", "email": "meena.krishnan@hospital.com", "dept_code": "NEUR", "spec": "Neurologist", "exp": 14},
    {"name": "Dr. Vijay Sharma", "email": "vijay.sharma@hospital.com", "dept_code": "ORTH", "spec": "Orthopedic Surgeon", "exp": 11},
    {"name": "Dr. Lakshmi Iyer", "email": "lakshmi.iyer@hospital.com", "dept_code": "GENM", "spec": "General Physician", "exp": 8},
    {"name": "Dr. Rajan Pillai", "email": "rajan.pillai@hospital.com", "dept_code": "PEDI", "spec": "Pediatrician", "exp": 9},
    {"name": "Dr. Ananya Singh", "email": "ananya.singh@hospital.com", "dept_code": "DERM", "spec": "Dermatologist", "exp": 7},
    {"name": "Dr. Karthik Menon", "email": "karthik.menon@hospital.com", "dept_code": "OPHT", "spec": "Ophthalmologist", "exp": 10},
    {"name": "Dr. Deepa Reddy", "email": "deepa.reddy@hospital.com", "dept_code": "EMRG", "spec": "Trauma Specialist", "exp": 13},
]

PATIENT_DATA = [
    {"name": "Rahul Gupta", "email": "rahul.gupta@email.com", "age": 34, "blood": "O+"},
    {"name": "Sunita Patel", "email": "sunita.patel@email.com", "age": 52, "blood": "B+"},
    {"name": "Mohan Das", "email": "mohan.das@email.com", "age": 27, "blood": "A+"},
    {"name": "Kavya Sharma", "email": "kavya.sharma@email.com", "age": 45, "blood": "AB+"},
    {"name": "Aruna Nair", "email": "aruna.nair@email.com", "age": 61, "blood": "O-"},
    {"name": "Deepak Kumar", "email": "deepak.kumar@email.com", "age": 38, "blood": "B-"},
    {"name": "Pooja Singh", "email": "pooja.singh@email.com", "age": 29, "blood": "A-"},
    {"name": "Ravi Iyer", "email": "ravi.iyer@email.com", "age": 55, "blood": "AB-"},
]


def seed_database(db: Session):
    """Populate the database with initial data if it's empty."""
    # Skip if already seeded
    if db.query(models.Department).count() > 0:
        print("[Seed] Database already populated. Skipping.")
        return

    print("[Seed] Populating database with initial data...")

    # 1. Create departments
    dept_map = {}
    for d in DEPARTMENTS:
        dept = models.Department(**d)
        db.add(dept)
        db.flush()
        dept_map[d["code"]] = dept
    db.commit()

    # 2. Create admin user
    admin_user = models.User(
        email="admin@hospital.com",
        password_hash=hash_password("Admin@123"),
        full_name="Hospital Administrator",
        role=models.UserRole.admin,
        phone="9900000000",
    )
    db.add(admin_user)
    db.commit()
    print("[Seed] Admin user: admin@hospital.com / Admin@123")

    # 3. Create doctor users + profiles
    for doc in DOCTORS_DATA:
        user = models.User(
            email=doc["email"],
            password_hash=hash_password("Doctor@123"),
            full_name=doc["name"],
            role=models.UserRole.doctor,
            phone=f"99{random.randint(10000000, 99999999)}",
        )
        db.add(user)
        db.flush()

        dept = dept_map[doc["dept_code"]]
        doctor = models.Doctor(
            user_id=user.id,
            department_id=dept.id,
            specialization=doc["spec"],
            experience_years=doc["exp"],
            max_daily_patients=30,
            avg_consultation_minutes=dept.avg_consultation_minutes,
            is_available=True,
        )
        db.add(doctor)
        db.flush()

        queue_state = models.QueueState(
            department_id=dept.id,
            doctor_id=doctor.id,
            waiting_count=random.randint(0, 10),
            avg_wait_time_predicted=random.uniform(5, 40),
        )
        db.add(queue_state)

    db.commit()
    print(f"[Seed] Created {len(DOCTORS_DATA)} doctors with queue states")

    # 4. Create patient users
    for p in PATIENT_DATA:
        patient_user = models.User(
            email=p["email"],
            password_hash=hash_password("Patient@123"),
            full_name=p["name"],
            role=models.UserRole.patient,
            age=p["age"],
            blood_group=p["blood"],
        )
        db.add(patient_user)
    db.commit()
    print(f"[Seed] Created {len(PATIENT_DATA)} demo patients (password: Patient@123)")

    # 5. Create reception staff user
    reception_email = "reception@hospital.com"
    if not db.query(models.User).filter(models.User.email == reception_email).first():
        reception_user = models.User(
            email=reception_email,
            password_hash=hash_password("Reception@123"),
            full_name="Reception Staff",
            phone="9876543210",
            role=models.UserRole.reception,
            is_active=True,
        )
        db.add(reception_user)
        db.commit()
        print("[SEED] Reception staff created")

    # 6. Create some sample appointments for today
    patients = db.query(models.User).filter(models.User.role == models.UserRole.patient).all()
    doctors = db.query(models.Doctor).all()
    now = datetime.now(timezone.utc)

    for i, patient in enumerate(patients[:6]):
        doctor = doctors[i % len(doctors)]
        status_choices = [
            models.AppointmentStatus.scheduled,
            models.AppointmentStatus.scheduled,
            models.AppointmentStatus.completed,
        ]
        appt = models.Appointment(
            patient_id=patient.id,
            doctor_id=doctor.id,
            appointment_time=now + timedelta(minutes=i * 20),
            status=random.choice(status_choices),
            priority_score=random.uniform(0, 60),
            priority_level=random.choice([
                models.PriorityLevel.normal,
                models.PriorityLevel.medium,
            ]),
            queue_position=i + 1,
            predicted_wait_minutes=random.uniform(10, 60),
        )
        db.add(appt)

    db.commit()
    print("[Seed] Sample appointments created")
    print("[Seed] Database seeding complete!")
    print()
    print("=" * 50)
    print("DEMO CREDENTIALS")
    print("=" * 50)
    print("  Admin    -> admin@hospital.com / Admin@123")
    print("  Doctor   -> arjun.ramesh@hospital.com / Doctor@123")
    print("  Patient  -> rahul.gupta@email.com / Patient@123")
    print("=" * 50)
