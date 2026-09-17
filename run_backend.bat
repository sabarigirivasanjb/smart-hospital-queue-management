@echo off
echo Starting SmartQueue Backend...
cd /d C:\Users\Sabari\.gemini\antigravity\scratch\smart-hospital-queue\backend
set PYTHONIOENCODING=utf-8
python -m uvicorn app.main:app --reload --port 8000
