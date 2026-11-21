@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   DOPE Whole-Laptop Assistant (Windows Launcher)
echo   Global Shortcut: Alt + D + T (Home Screen & All Apps)
echo ========================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python 3.10+ is not installed or not in PATH.
    echo Install Python from https://www.python.org/downloads/ and check "Add Python to PATH".
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    python -m venv .venv
)

call ".venv\Scripts\activate.bat"

echo Installing/verifying DOPE Desktop packages...
pip install --upgrade pip >nul 2>nul
pip install requests keyboard pynput SpeechRecognition pyttsx3 pywinauto pycaw comtypes
pip install PyAudio >nul 2>nul
if errorlevel 1 (
    echo [Note] PyAudio wheel skipped; using text/system fallback if mic module is missing.
)

echo.
echo Starting DOPE Whole-Laptop Assistant...
echo Press Alt + D + T anywhere on your laptop to activate DOPE!
echo.
python dope_companion.py
pause
