# 📦 Campfire Widget Desktop App - Quick Install Guide

## Option 1: Quick Install (Pre-built)

1. **Double-click**: `install-now.bat` in the `desktop-app` folder
2. Follow the installer wizard
3. Launch from Start Menu or Desktop shortcut

## Option 2: Build & Install (From Source)

If you want to rebuild the installer:

1. **Double-click**: `build-and-install.bat` in the `desktop-app` folder
2. This will:
   - Sync server files
   - Install Node.js dependencies
   - Build the Windows installer
   - Launch the installer

## Option 3: Manual Build

```bash
cd desktop-app
npm install
cd server && npm install && cd ..
npm run build:win
```

## Running the App

After installation:
- **Start Menu**: Search for "Campfire Widget"
- **Desktop**: Double-click "Campfire Widget" shortcut

## Troubleshooting

### "Windows protected your PC"
Click "More info" → "Run anyway" (this is a normal warning for unsigned apps)

### Installer won't start
1. Make sure Node.js is installed (https://nodejs.org/)
2. Run `build-and-install.bat` to rebuild

### App won't launch
Check the `dist/win-unpacked/` folder for logs

## Uninstall

Use Windows "Add or Remove Programs" to uninstall Campfire Widget
