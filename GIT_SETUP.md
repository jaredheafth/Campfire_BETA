# Git Setup and Desktop App Distribution Guide

This guide walks you through setting up Git for the project and creating downloadable desktop app builds.

## Part 1: Git Repository Setup

### Initial Git Setup (if not already done)

1. **Initialize Git repository** (if not already initialized):
   ```bash
   cd /Users/jaredheath/Sidedesk/xCODING/Cursor/!IDEAS/idea_SLOBS_Widget_Campfire
   git init
   ```

2. **Add all files** (respecting .gitignore):
   ```bash
   git add .
   ```

3. **Create initial commit**:
   ```bash
   git commit -m "Initial commit: Campfire Widget with desktop app"
   ```

### Connect to GitHub (or other Git host)

1. **Create a new repository on GitHub**:
   - Go to https://github.com/new
   - Name it something like `campfire-widget` or `slobs-campfire-widget`
   - Choose public or private
   - **Don't** initialize with README, .gitignore, or license (we already have these)

2. **Add remote and push**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

### Future Updates

When you make changes:
```bash
git add .
git commit -m "Description of changes"
git push
```

## Part 2: Building the Desktop App

### Prerequisites

1. **Install Node.js** (if not already installed):
   - Download from https://nodejs.org/ (LTS version recommended)
   - Verify installation: `node --version` and `npm --version`

2. **Install Electron Builder** (already in package.json, but verify):
   ```bash
   cd desktop-app
   npm install
   ```

### Building for macOS

1. **Build DMG installer**:
   ```bash
   cd desktop-app
   npm run build:mac
   ```

2. **Output location**:
   - The DMG file will be in `desktop-app/dist/`
   - File name will be something like `Campfire Widget-1.0.0.dmg`

3. **Test the build**:
   - Double-click the DMG file
   - Drag the app to Applications folder
   - Open the app and test

### Building for Windows

1. **Build Windows installer** (from macOS, you'll need Wine or a Windows machine):
   ```bash
   cd desktop-app
   npm run build:win
   ```

2. **Output location**:
   - The installer will be in `desktop-app/dist/`
   - File name will be something like `Campfire Widget Setup 1.0.0.exe`

### Building for Both Platforms

```bash
cd desktop-app
npm run build:all
```

## Part 3: Creating GitHub Releases

### Manual Release Process

1. **Tag the release**:
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

2. **Create release on GitHub**:
   - Go to your repository on GitHub
   - Click "Releases" → "Create a new release"
   - Choose the tag you just created
   - Add release notes
   - Upload the built DMG/EXE files as assets
   - Click "Publish release"

### Automated Release (Optional - using GitHub Actions)

Create `.github/workflows/release.yml`:

```yaml
name: Build and Release

on:
  release:
    types: [created]

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd desktop-app
          npm install
      
      - name: Build app
        run: |
          cd desktop-app
          if [ "${{ runner.os }}" == "macOS" ]; then
            npm run build:mac
          else
            npm run build:win
          fi
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ runner.os }}-build
          path: desktop-app/dist/*
```

## Part 4: Distribution Checklist

Before releasing:

- [ ] Test the desktop app on a clean machine (not your dev machine)
- [ ] Verify all features work (server starts, dashboard loads, widget displays)
- [ ] Check that sprites load correctly
- [ ] Test Twitch integration (if applicable)
- [ ] Update version number in `desktop-app/package.json`
- [ ] Update README with current features
- [ ] Create release notes with:
  - New features
  - Bug fixes
  - Known issues
  - System requirements

## Part 5: System Requirements

Include these in your release notes:

**macOS:**
- macOS 10.13 or later
- Node.js runtime (bundled with app)

**Windows:**
- Windows 10 or later
- Node.js runtime (bundled with app)

## Part 6: Troubleshooting Build Issues

### Missing Assets

If build fails due to missing assets:
1. Check that `desktop-app/assets/` contains:
   - `icon.png` (for macOS)
   - `icon.ico` (for Windows)
   - `tray-icon.png` (optional, for system tray)

2. Create placeholder icons if missing:
   - Use an online icon generator
   - Or create simple PNG files (256x256 for macOS, 256x256 for Windows)

### Build Errors

1. **"electron-builder not found"**:
   ```bash
   cd desktop-app
   npm install electron-builder --save-dev
   ```

2. **"Cannot find module"**:
   ```bash
   cd desktop-app
   npm install
   cd server
   npm install
   ```

3. **Code signing issues (macOS)**:
   - For distribution outside App Store, you may need to sign the app
   - For testing, you can right-click → Open (bypass Gatekeeper)
   - Or disable Gatekeeper temporarily: `sudo spctl --master-disable` (not recommended for production)

## Part 7: Quick Start for Users

Create a simple download and install guide:

1. **Download** the DMG (macOS) or EXE (Windows) from GitHub Releases
2. **Install**:
   - **macOS**: Open DMG, drag to Applications
   - **Windows**: Run the EXE installer
3. **Launch** the app from Applications/Start Menu
4. **First Run**: The server starts automatically, dashboard opens in 2 seconds
5. **Access Widget**: Open `http://localhost:3000/widget.html` in OBS Browser Source

## Notes

- The desktop app bundles Node.js, so users don't need to install it separately
- The app runs a local server on port 3000
- All data is stored locally (localStorage, no cloud sync)
- The app can run in the system tray (minimize to tray)
