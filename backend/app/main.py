"""
Smart Hospital Queue Management System — FastAPI Backend
"""

import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, get_db
from . import models
from .routers import auth, patients, doctors, admins, billing, feedback
from .utils.websocket import ws_manager
from .seed import seed_database

# ── Create all DB tables ───────────────────────────────────────────────────────
models.Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup & shutdown events."""
    print("[INFO] Smart Hospital Queue System starting...")
    # Seed database with initial data
    from .database import SessionLocal
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    # ML models are auto-loaded/trained when imported (singletons)
    print("[INFO] System ready!")
    yield
    print("[INFO] Server shutting down.")


# ── App definition ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Smart Hospital Queue Management API",
    description="AI-powered hospital queue management with emergency prioritization",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React frontend (both localhost and 127.0.0.1)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(doctors.router, prefix="/api/v1")
app.include_router(admins.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")
app.include_router(feedback.router, prefix="/api/v1")


# ── REST: public endpoints ─────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "message": "🏥 Smart Hospital Queue Management API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/api/v1/departments")
def list_departments_public(db: Session = Depends(get_db)):
    """Public endpoint: list all departments (no auth required for booking UI)."""
    depts = db.query(models.Department).filter(models.Department.is_active == True).all()
    return [{"id": d.id, "name": d.name, "code": d.code, "description": d.description} for d in depts]


@app.get("/api/v1/doctors/public")
def list_doctors_public(department_id: int = None, db: Session = Depends(get_db)):
    """Public endpoint: list available doctors (for appointment booking)."""
    query = db.query(models.Doctor).filter(models.Doctor.is_available == True)
    if department_id:
        query = query.filter(models.Doctor.department_id == department_id)
    doctors = query.all()
    return [
        {
            "id": d.id,
            "name": d.user.full_name if d.user else f"Doctor #{d.id}",
            "department": d.department.name if d.department else "",
            "specialization": d.specialization,
            "avg_consultation_minutes": d.avg_consultation_minutes,
            "experience_years": d.experience_years,
        }
        for d in doctors
    ]


# ── WebSocket: Patient live queue ──────────────────────────────────────────────
@app.websocket("/ws/patient/{user_id}")
async def patient_websocket(websocket: WebSocket, user_id: int):
    """Real-time queue updates for a specific patient."""
    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo ping/pong to keep connection alive
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id)


# ── WebSocket: Department feed (doctors & admin) ───────────────────────────────
@app.websocket("/ws/department/{department_id}")
async def department_websocket(websocket: WebSocket, department_id: int):
    """Real-time department queue feed for doctors and admins."""
    await ws_manager.connect_department(websocket, department_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        ws_manager.disconnect_department(websocket, department_id)
