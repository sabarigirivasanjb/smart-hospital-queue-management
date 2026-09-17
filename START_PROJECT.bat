@echo off
title SmartQueue Hospital
color 0A
cls

echo.
echo  ============================================================
echo   AI-POWERED SMART HOSPITAL QUEUE MANAGEMENT SYSTEM v2.0
echo  ============================================================
echo.

REM ── STEP 1: Kill old processes ─────────────────────────────────
echo  [1/5] Stopping old servers...
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im uvicorn.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo  [1/5] Done.
echo.

REM ── STEP 2: Clear caches ───────────────────────────────────────
echo  [2/5] Clearing caches (fixing refresh issue)...
if exist "%~dp0frontend\node_modules\.vite" rmdir /s /q "%~dp0frontend\node_modules\.vite"
if exist "%~dp0frontend\.vite" rmdir /s /q "%~dp0frontend\.vite"
if exist "%~dp0backend\app\__pycache__" rmdir /s /q "%~dp0backend\app\__pycache__"
if exist "%~dp0backend\app\routers\__pycache__" rmdir /s /q "%~dp0backend\app\routers\__pycache__"
echo  [2/5] Caches cleared.
echo.

REM ── STEP 3: Start Backend ──────────────────────────────────────
echo  [3/5] Starting Backend (port 8000)...
start "BACKEND" cmd /k "cd /d %~dp0backend && set PYTHONIOENCODING=utf-8 && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
echo  [3/5] Backend window opened.
echo.
echo  Waiting 8 seconds for backend...
timeout /t 8 /nobreak >nul

REM ── STEP 4: Start Frontend ─────────────────────────────────────
echo  [4/5] Starting Frontend (port 5173)...
start "FRONTEND" cmd /k "cd /d %~dp0frontend && npm run dev -- --host 127.0.0.1 --port 5173"
echo  [4/5] Frontend window opened.
echo.
echo  Waiting 8 seconds for Vite to compile...
timeout /t 8 /nobreak >nul

REM ── STEP 5: Open Browser ───────────────────────────────────────
echo  [5/5] Opening browser...
start "" "http://127.0.0.1:5173"
echo  [5/5] Done!
echo.

cls
echo.
echo  ============================================================
echo   SYSTEM IS RUNNING!
echo  ============================================================
echo.
echo   App URL  :  http://127.0.0.1:5173
echo   Backend  :  http://127.0.0.1:8000
echo   API Docs :  http://127.0.0.1:8000/docs
echo.
echo  ============================================================
echo   LOGIN CREDENTIALS
echo  ============================================================
echo.
echo   ADMIN:
echo     admin@hospital.com          /  Admin@123
echo     sabari2005@gmail.com        /  Sabari@123
echo.
echo   DOCTORS:
echo     priya.nair@hospital.com     /  Doctor@123
echo     arjun.ramesh@hospital.com   /  Doctor@123
echo     suresh.kumar@hospital.com   /  Doctor@123
echo     meena.krishnan@hospital.com /  Doctor@123
echo     vijay.sharma@hospital.com   /  Doctor@123
echo     lakshmi.iyer@hospital.com   /  Doctor@123
echo     rajan.pillai@hospital.com   /  Doctor@123
echo     ananya.singh@hospital.com   /  Doctor@123
echo     karthik.menon@hospital.com  /  Doctor@123
echo     deepa.reddy@hospital.com    /  Doctor@123
echo     varadha@gmail.com           /  Varadha@123
echo     miru2008@gmail.com          /  Mridula@123
echo     reddy2005@gmail.com         /  Reddy@123
echo.
echo   PATIENTS:
echo     rahul.gupta@email.com       /  Patient@123
echo     sunita.patel@email.com      /  Patient@123
echo     mohan.das@email.com         /  Patient@123
echo     kavya.sharma@email.com      /  Patient@123
echo     aruna.nair@email.com        /  Patient@123
echo     deepak.kumar@email.com      /  Patient@123
echo     pooja.singh@email.com       /  Patient@123
echo     ravi.iyer@email.com         /  Patient@123
echo     vipin2006@gmail.com         /  Vipin@123
echo.
echo  ============================================================
echo   ALL FEATURES v2.0
echo  ============================================================
echo.
echo   [1] Vitals Entry     - Manual Heart Rate / SpO2 / Temp / Pain
echo   [2] SmartWatch BLE   - Optional Bluetooth auto-fill
echo   [3] SMS + Screen Alert - "You're Next!" notification
echo   [4] Bill Generation  - Consultation + Lab + Medicine
echo   [5] Tamil Language   - Globe icon top-right
echo   [6] Patient Feedback - Star rating
echo   [7] AI Triage        - Priority + risk scoring
echo   [8] Live Queue       - Real-time WebSocket
echo.
echo  ============================================================
echo   DEMO FLOW
echo  ============================================================
echo.
echo   Patient : Login - Book Appt - Triage - Queue Status
echo   Doctor  : Login - Call Next (SMS fires!) - Complete
echo   Admin   : Login - Full Dashboard
echo.
echo  ============================================================
echo.
echo   Browser opened at http://127.0.0.1:5173
echo   Press any key to close this info window.
echo   (Servers keep running in their own windows)
echo.
pause >nul
