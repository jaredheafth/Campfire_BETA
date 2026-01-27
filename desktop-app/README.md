# 🔥 Campfire Widget Desktop App

Desktop application for the Campfire Widget with automatic installer generation.

## Building the Installers

### Prerequisites

1. Install Node.js (if not already installed)
2. Install dependencies:
```bash
npm install
```

### Build for Windows

```bash
npm run build:win
```

This creates a Windows installer (`.exe`) in the `dist/` folder.

### Build for Mac

```bash
npm run build:mac
```

This creates a Mac installer (`.dmg`) in the `dist/` folder.

### Build for Both

```bash
npm run build:all
```

## Project Structure

```
desktop-app/
├── main.js              # Electron main process
├── preload.js           # Preload script for security
├── package.json         # App configuration
├── server/              # Server files (copied from parent)
│   ├── server.js
│   ├── dashboard.html
│   ├── widget.html
│   └── viewer-dashboard.html
└── assets/              # App icons
    ├── icon.png
    ├── icon.ico (Windows)
    └── icon.icns (Mac)
```

## Setup Instructions

1. **Copy server files:**
   - Copy `server.js`, `dashboard.html`, `widget.html`, `viewer-dashboard.html` from parent directory to `desktop-app/server/`

2. **Add icons:**
   - Place app icons in `desktop-app/assets/`
   - Windows: `icon.ico` (256x256)
   - Mac: `icon.icns` (512x512)
   - Fallback: `icon.png` (512x512)

3. **Install dependencies:**
   ```bash
   cd desktop-app
   npm install
   ```

4. **Build installers:**
   ```bash
   npm run build:win    # Windows
   npm run build:mac    # Mac
   ```

5. **Distribute:**
   - Windows: Share the `.exe` file from `dist/`
   - Mac: Share the `.dmg` file from `dist/`

## Features

- ✅ One-click installer for Windows and Mac
- ✅ Automatic server startup
- ✅ System tray integration
- ✅ Dashboard opens automatically
- ✅ Start/stop server controls
- ✅ No manual file placement needed

## User Experience

1. User downloads installer
2. Runs installer (standard install process)
3. App installs to Applications/Program Files
4. User opens app from Start Menu/Applications
5. Server starts automatically
6. Dashboard opens in app window
7. User configures settings
8. User copies widget code to Streamlabs

## Development

To run in development mode:

```bash
npm start
```

This opens the app with DevTools enabled.
