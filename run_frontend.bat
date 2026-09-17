@echo off
title SmartQueue - Frontend Only
color 0B

echo.
echo  ==========================================
echo    SMART HOSPITAL QUEUE - FRONTEND ONLY
echo  ==========================================
echo.

REM ── Kill any old process on port 5173 ────────────────────────
echo [Step 1] Freeing port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [Step 1] Done.

REM ── Start Frontend ────────────────────────────────────────────
echo [Step 2] Starting Frontend (React/Vite on port 5173)...
start "SmartQueue Frontend" cmd /k "cd /d %~dp0frontend && powershell -ExecutionPolicy Bypass -Command npm run dev"

REM ── Wait for frontend to initialize ──────────────────────────
echo [Step 2] Waiting for frontend to initialize...
timeout /t 5 /nobreak > nul

REM ── Open browser automatically ─────────────────────────────────
echo [Step 3] Opening browser...
start "" "http://localhost:5173"

echo.
echo  ==========================================
echo    FRONTEND IS RUNNING!
echo  ==========================================
echo.
echo    Open : http://localhost:5173
echo.
echo    Close the Frontend window to stop.
echo.
pause
