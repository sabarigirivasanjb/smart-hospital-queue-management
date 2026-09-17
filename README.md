# 🏥 SmartQueue — AI-Powered Hospital Queue Management System

> An intelligent hospital queue management system with real-time triage prioritization, IoT-based vitals monitoring, SMS notifications, and multilingual support.

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Triage** | Symptoms + Vitals → Risk Score (0–100) → Auto Priority |
| 📊 **Live Queue** | Real-time WebSocket queue updates |
| 📱 **SMS Alerts** | "You're Next!" via Twilio |
| 🔔 **Screen Banner** | Green/Orange alert with beep sound |
| 📶 **SmartWatch BLE** | Bluetooth vitals auto-fill (optional) |
| 💳 **Bill Generation** | Consultation + Lab + Medicine charges |
| ⭐ **Patient Feedback** | Star rating after appointment |
| 🌐 **Tamil Language** | Full Tamil + English UI support |
| 🛡️ **Role-Based Auth** | Patient / Doctor / Admin dashboards |

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | FastAPI + Python |
| Database | SQLite + SQLAlchemy |
| Auth | JWT + bcrypt |
| Real-time | WebSocket |
| SMS | Twilio |
| Charts | Chart.js |
| IoT | Web Bluetooth API |

---

## 📁 Project Structure

```
smart-hospital-queue/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── pages/     # Patient, Doctor, Admin dashboards
│   │   ├── components/# Reusable components
│   │   ├── context/   # Auth context
│   │   └── api.js     # Axios API calls
│   └── vite.config.js
├── backend/           # FastAPI backend
│   └── app/
│       ├── routers/   # auth, patients, doctors, admin, billing, feedback
│       ├── ai/        # Triage AI + Wait Time Model
│       ├── utils/     # WebSocket + SMS service
│       ├── models.py  # SQLAlchemy DB models
│       └── main.py    # FastAPI app entry
├── START_PROJECT.bat  # One-click launcher (Windows)
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/smart-hospital-queue.git
cd smart-hospital-queue
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

### 4. Run the Project
```bash
# Windows — just double-click:
START_PROJECT.bat

# OR manually:
# Terminal 1 (Backend)
cd backend && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 (Frontend)
cd frontend && npm run dev -- --host 127.0.0.1 --port 5173
```

### 5. Open Browser
```
http://127.0.0.1:5173
```

---

## 🔑 Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hospital.com | Admin@123 |
| Doctor | arjun.ramesh@hospital.com | Doctor@123 |
| Patient | rahul.gupta@email.com | Patient@123 |

---

## 📱 SMS Setup (Optional)

To enable real SMS notifications:
1. Create a [Twilio](https://twilio.com) account
2. Create `.env` file in `backend/`:
```env
SMS_ENABLED=true
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

> Without `.env`, the system runs in **demo mode** — SMS messages are logged to console.

---

## 🏗️ Architecture

```
Patient/Doctor/Admin
        │
   React Frontend (5173)
        │ HTTP Axios / WebSocket
   FastAPI Backend (8000)
        │
    ┌───┴───┐
    │       │
 SQLite   Twilio SMS
   DB      API
```

---

## 📊 Demo Flow

```
Patient  → Login → Book Appointment → Triage (enter vitals)
        → AI assigns priority → Join Queue
Doctor   → Login → See Queue → Click "Call Next"
        → SMS sent to patient → Patient gets screen alert
Admin    → Login → View Analytics → Manage Departments/Doctors
```

---

## 👨‍💻 Developed By

**Sabari** — AI-Powered Smart Hospital Queue Management System  
📅 2026

---

## 📄 License

MIT License — Free to use for academic and educational purposes.
