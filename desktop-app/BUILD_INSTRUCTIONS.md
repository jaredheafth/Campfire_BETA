# 📦 Building Installers - Step by Step

## Quick Start

1. **Copy server files to desktop-app/server/**
   ```bash
   # From project root
   cp server.js desktop-app/server/
   cp dashboard.html desktop-app/server/
   cp widget.html desktop-app/server/
   cp viewer-dashboard.html desktop-app/server/
   cp package.json desktop-app/server/  # For server dependencies
   ```

2. **Install desktop app dependencies**
   ```bash
   cd desktop-app
   npm install
   ```

3. **Install server dependencies in server folder**
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Add app icons** (optional but recommended)
   - Windows: `assets/icon.ico` (256x256)
   - Mac: `assets/icon.icns` (512x512)
   - Fallback: `assets/icon.png` (512x512)

5. **Build installers**
   ```bash
   npm run build:win    # Windows installer
   npm run build:mac    # Mac installer
   ```

6. **Find installers**
   - Windows: `dist/Campfire Widget Setup x.x.x.exe`
   - Mac: `dist/Campfire Widget-x.x.x.dmg`

## Detailed Instructions

### For Windows Users

1. Install Node.js from https://nodejs.org/
2. Open Command Prompt or PowerShell
3. Navigate to `desktop-app` folder
4. Run: `npm install`
5. Run: `npm run build:win`
6. Installer will be in `dist/` folder

### For Mac Users

1. Install Node.js from https://nodejs.org/
2. Open Terminal
3. Navigate to `desktop-app` folder
4. Run: `npm install`
5. Run: `npm run build:mac`
6. Installer will be in `dist/` folder

## Troubleshooting

### "electron-builder not found"
Run: `npm install --save-dev electron-builder`

### "Cannot find module"
Make sure you copied all server files to `desktop-app/server/`

### Build fails
- Make sure Node.js is installed
- Try deleting `node_modules` and running `npm install` again
- Check that all required files exist

## Distribution

Once built, you can:
- Upload installers to a file hosting service
- Share via Google Drive, Dropbox, etc.
- Host on your website
- Distribute via GitHub Releases

Users just need to:
1. Download the installer
2. Run it
3. Follow installation wizard
4. Open app from Start Menu/Applications
