# 📦 GitHub Releases Guide - Desktop App Distribution

## Overview

This guide walks you through building the desktop app installers and uploading them to GitHub Releases so users can download and install the Campfire Widget desktop app.

---

## Prerequisites

1. **Node.js installed** (v16 or higher)
2. **Git repository** with your code pushed to GitHub
3. **Build tools** (automatically installed with npm install)

---

## Step 1: Prepare for Build

### 1.1 Sync Server Files

The desktop app needs the latest server files. Run the setup script:

**Mac/Linux:**
```bash
cd desktop-app
chmod +x setup.sh
./setup.sh
```

**Windows:**
```bash
cd desktop-app
setup.bat
```

This copies the latest `server.js`, `widget.html`, `dashboard.html`, and `viewer-dashboard.html` to `desktop-app/server/`.

### 1.2 Install Dependencies

```bash
cd desktop-app

# Install desktop app dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### 1.3 Add App Icons (Optional but Recommended)

Place app icons in `desktop-app/assets/`:
- `icon.png` (512x512) - Fallback icon
- `icon.ico` (256x256) - Windows icon
- `icon.icns` (512x512) - Mac icon

If icons are missing, the build will still work but use default Electron icons.

---

## Step 2: Build Installers

### 2.1 Update Version (Important!)

Before building, update the version in `desktop-app/package.json`:

```json
{
  "version": "1.0.0"  // Update this to your release version
}
```

### 2.2 Build for Your Platform

**Build for Windows:**
```bash
npm run build:win
```

**Build for Mac:**
```bash
npm run build:mac
```

**Build for Both:**
```bash
npm run build:all
```

### 2.3 Find Your Installers

After building, installers will be in `desktop-app/dist/`:
- **Windows**: `Campfire Widget Setup 1.0.0.exe` (NSIS installer)
- **Mac**: `Campfire Widget-1.0.0.dmg` (disk image)

---

## Step 3: Create GitHub Release

### 3.1 Tag Your Release

First, create a git tag for the version:

```bash
# From project root
git add .
git commit -m "Release v1.0.0 - Desktop app ready"
git tag -a v1.0.0 -m "Release v1.0.0 - Desktop app with full installer"
git push origin main
git push origin v1.0.0
```

### 3.2 Create Release on GitHub

1. **Go to your GitHub repository**
2. **Click "Releases"** (right sidebar)
3. **Click "Create a new release"**
4. **Fill in the form:**
   - **Tag**: Select `v1.0.0` (or create new tag)
   - **Release title**: `Campfire Widget v1.0.0 - Desktop App`
   - **Description**: Use the template below
   - **Attach binaries**: Upload both `.exe` and `.dmg` files

### 3.3 Release Notes Template

```markdown
# 🔥 Campfire Widget v1.0.0 - Desktop App

## What's New

- ✅ Full desktop app with installer
- ✅ Automatic server startup
- ✅ System tray integration
- ✅ Built-in dashboard
- ✅ Twitch chat integration
- ✅ Viewer dashboard for customization
- ✅ Sprite system with animations
- ✅ Member management (mute, still, kick)

## Installation

### Windows
1. Download `Campfire Widget Setup 1.0.0.exe`
2. Run the installer
3. Follow the installation wizard
4. Open "Campfire Widget" from Start Menu
5. Configure your settings in the dashboard

### Mac
1. Download `Campfire Widget-1.0.0.dmg`
2. Open the DMG file
3. Drag "Campfire Widget" to Applications
4. Open from Applications folder
5. Configure your settings in the dashboard

## First Time Setup

1. **Open the app** - Server starts automatically
2. **Configure Twitch** - Edit `server.js` in the app directory with your Twitch credentials:
   - Get OAuth token from: https://twitchtokengenerator.com/
   - Scope needed: `chat:read`
3. **Open Dashboard** - Click "Open Dashboard" in the app
4. **Configure Settings** - Upload campfire graphic, set permissions, etc.
5. **Get Widget Code** - Copy code from "Code" tab
6. **Add to OBS** - Use Browser Source with `http://localhost:3000/widget.html`

## Features

- 🎨 Custom campfire graphics (GIF/video)
- 👥 Viewer sprites around campfire
- 💬 Chat integration (`!join` command)
- 🎭 Sprite animations and customization
- 👑 Permission system (subs, VIP, mods)
- 🎛️ Streamer dashboard for control
- 👤 Viewer dashboard for customization
- 🔇 Member management (mute, still, kick)

## System Requirements

- **Windows**: Windows 10 or later
- **Mac**: macOS 10.13 or later
- **Internet**: Required for Twitch chat (widget works offline otherwise)

## Support

- Report issues on GitHub
- Check documentation in the repository

## Changelog

### v1.0.0
- Initial desktop app release
- Full installer support
- System tray integration
- All core features implemented
```

---

## Step 4: Upload Installers

1. **In the GitHub Release page**, scroll to "Attach binaries"
2. **Drag and drop** or click to upload:
   - `Campfire Widget Setup 1.0.0.exe` (Windows)
   - `Campfire Widget-1.0.0.dmg` (Mac)
3. **Click "Publish release"**

---

## Step 5: Share with Users

Once published, users can:
1. Go to your GitHub Releases page
2. Download the installer for their platform
3. Install and use!

**Release URL format:**
```
https://github.com/YOUR_USERNAME/YOUR_REPO/releases/tag/v1.0.0
```

---

## Automated Build Script (Optional)

Create a `build-release.sh` script to automate everything:

```bash
#!/bin/bash
# build-release.sh - Automated build and release preparation

set -e

VERSION=${1:-"1.0.0"}
echo "Building version $VERSION"

# Update version in package.json
cd desktop-app
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

# Sync server files
./setup.sh

# Install dependencies
npm install
cd server && npm install && cd ..

# Build installers
echo "Building Windows installer..."
npm run build:win

echo "Building Mac installer..."
npm run build:mac

echo ""
echo "✅ Build complete!"
echo "📦 Installers are in desktop-app/dist/"
echo ""
echo "Next steps:"
echo "1. Test the installers"
echo "2. Create git tag: git tag -a v$VERSION -m 'Release v$VERSION'"
echo "3. Push tag: git push origin v$VERSION"
echo "4. Create GitHub Release and upload installers"
```

Make it executable:
```bash
chmod +x build-release.sh
```

Run it:
```bash
./build-release.sh 1.0.0
```

---

## Troubleshooting

### Build Fails

**Error: "electron-builder not found"**
```bash
cd desktop-app
npm install --save-dev electron-builder
```

**Error: "Cannot find module"**
- Make sure you ran `setup.sh` or `setup.bat` to copy server files
- Check that `desktop-app/server/` contains all files

**Error: "Icon not found"**
- Build will still work without icons
- Add icons to `desktop-app/assets/` for better branding

### Installer Issues

**Windows: Antivirus flags installer**
- This is common with NSIS installers
- You may need to code-sign the installer (requires certificate)
- For now, users may need to click "More info" → "Run anyway"

**Mac: "App is damaged" error**
- Users need to right-click → Open (first time only)
- Or run: `xattr -cr /Applications/Campfire\ Widget.app`
- Consider code-signing for production releases

---

## Version Management

### Semantic Versioning

Use semantic versioning:
- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes

### Updating Version

1. Update `desktop-app/package.json` version
2. Update release notes
3. Create new git tag
4. Build new installers
5. Create new GitHub Release

---

## Next Steps After Release

1. **Test the installers** on clean machines
2. **Monitor GitHub Issues** for user feedback
3. **Plan next version** based on feedback
4. **Consider code-signing** for future releases (removes security warnings)

---

## Quick Reference

```bash
# Full build process
cd desktop-app
./setup.sh              # Sync files
npm install              # Install deps
cd server && npm install && cd ..
npm run build:all        # Build both platforms

# Create release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Then create GitHub Release and upload dist/* files
```

---

## Summary

1. ✅ Sync server files (`setup.sh` or `setup.bat`)
2. ✅ Install dependencies (`npm install` in desktop-app and server)
3. ✅ Build installers (`npm run build:win` / `build:mac`)
4. ✅ Create git tag (`git tag -a v1.0.0`)
5. ✅ Push tag (`git push origin v1.0.0`)
6. ✅ Create GitHub Release (upload installers)
7. ✅ Share with users!

Your desktop app is now ready for distribution! 🎉
