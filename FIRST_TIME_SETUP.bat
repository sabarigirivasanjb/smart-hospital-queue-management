@echo off
title SmartQueue - First Time Setup
color 0A
echo.
echo =============================================
echo   SMART HOSPITAL QUEUE - FIRST TIME SETUP
echo =============================================
echo.
echo [Step 1] Installing Backend Python packages...
cd /d %~dp0backend
pip install -r requirements.txt
echo [Step 1] Done!
echo.
echo [Step 2] Installing Frontend Node packages...
cd /d %~dp0frontend
npm install
echo [Step 2] Done!
echo.
echo =============================================
echo   SETUP COMPLETE! Now run START_PROJECT.bat
echo =============================================
pause
