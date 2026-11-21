# DOPE Linux Installation Guide

## 1. Supported Distributions & Display Servers
- Ubuntu 22.04+, Fedora 39+, Debian 12+, Arch Linux
- **X11 Sessions**: Full support for app launching, volume (`pactl`), and active window controls (`xdotool`).
- **Wayland Sessions (GNOME / KDE Plasma)**: Wayland isolates windows for security. Global window switching (`Alt+Tab` injection) and programmatic minimize/maximize are **blocked by Wayland** unless you install a compositor-specific extension. DOPE detects Wayland automatically and reports this limitation honestly instead of pretending it worked.

## 2. Install Dependencies
Ubuntu/Debian example:
```bash
sudo apt update
sudo apt install python3-venv portaudio19-dev xdotool pulseaudio-utils at-spi2-core
cd platforms/desktop-companion
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. Permissions & Audio Setup
- Ensure your user belongs to the `audio` group if PipeWire/ALSA denies microphone access.
- On GNOME/KDE, enable **Accessibility** in Desktop Settings if using AT-SPI screen-element inspection.

## 4. Running & Packaging
- Run directly with `python dope_companion.py`, or package as an **AppImage** / `.deb` containing the Python virtual environment and desktop `.desktop` autostart entry under `~/.config/autostart/dope.desktop`.

## 5. Uninstall on Linux
- Remove `~/.config/autostart/dope.desktop` and delete the `dope-assistant` folder (or run `sudo apt remove dope-companion` if packaged as a `.deb`).
