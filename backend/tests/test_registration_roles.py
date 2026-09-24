from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_public_registration_rejects_doctor_role():
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "doctor.public@test.com",
            "password": "Doctor@123",
            "full_name": "Public Doctor",
            "role": "doctor",
        },
    )
    assert resp.status_code == 403


def test_public_registration_rejects_reception_role():
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "reception.public@test.com",
            "password": "Reception@123",
            "full_name": "Public Reception",
            "role": "reception",
        },
    )
    assert resp.status_code == 403


def test_patient_registration_remains_allowed():
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "patient.public@test.com",
            "password": "Patient@123",
            "full_name": "Public Patient",
            "role": "patient",
        },
    )
    assert resp.status_code in (200, 201)
