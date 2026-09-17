@echo off
echo ==========================================
echo  Smart Hospital Queue Management System
echo ==========================================
echo.
echo [1/2] Starting Backend (FastAPI)...
start "Hospital Backend" cmd /k "cd /d %~dp0backend && set PYTHONIOENCODING=utf-8 && python -m uvicorn app.main:app --reload --port 8000"

echo [2/2] Starting Frontend (React + Vite)...
timeout /t 5 /nobreak > nul
start "Hospital Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ==========================================
echo  System starting...
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:5173
echo  API Docs: http://localhost:8000/docs
echo ==========================================
echo.
echo Demo Credentials:
echo   Admin:   admin@hospital.com  /  Admin@123
echo   Doctor:  arjun.ramesh@hospital.com  /  Doctor@123
echo   Patient: rahul.gupta@email.com  /  Patient@123
echo.
pause
