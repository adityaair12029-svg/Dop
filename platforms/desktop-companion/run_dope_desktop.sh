#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] Python 3 is required. Install Python 3.10+ first."
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet requests keyboard pynput SpeechRecognition pyttsx3

echo "Starting DOPE Whole-Laptop Assistant (Alt + D + T)..."
python3 dope_companion.py
