# Quick Git Setup & Desktop App Build Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Initialize Git (if not done)
```bash
cd /Users/jaredheath/Sidedesk/xCODING/Cursor/!IDEAS/idea_SLOBS_Widget_Campfire
git init
git add .
git commit -m "Initial commit: Campfire Widget v1.0.0"
```

### Step 2: Create GitHub Repository
1. Go to https://github.com/new
2. Name it: `campfire-widget` (or your preferred name)
3. Choose Public or Private
4. **Don't** check "Initialize with README"
5. Click "Create repository"

### Step 3: Connect and Push
```bash
# Replace YOUR_USERNAME and YOUR_REPO_NAME with your actual values
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### Step 4: Build Desktop App for macOS
```bash
cd desktop-app
npm install
npm run build:mac
```

The DMG file will be in `desktop-app/dist/`

### Step 5: Create GitHub Release
1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Tag: `v1.0.0`
4. Title: `Version 1.0.0`
5. Upload the DMG file from `desktop-app/dist/`
6. Click "Publish release"

## 📦 Building for Distribution

### macOS Build
```bash
cd desktop-app
npm run build:mac
# Output: desktop-app/dist/Campfire Widget-1.0.0.dmg
```

### Windows Build (requires Windows or Wine)
```bash
cd desktop-app
npm run build:win
# Output: desktop-app/dist/Campfire Widget Setup 1.0.0.exe
```

### Both Platforms
```bash
cd desktop-app
npm run build:all
```

## 🔄 Updating and Releasing

### When you make changes:
```bash
# 1. Make your changes
# 2. Test everything
# 3. Update version in desktop-app/package.json
# 4. Commit and push
git add .
git commit -m "Description of changes"
git push

# 5. Tag the release
git tag -a v1.0.1 -m "Release version 1.0.1"
git push origin v1.0.1

# 6. Build new version
cd desktop-app
npm run build:mac  # or build:win

# 7. Create new GitHub release with the new build
```

## ✅ Pre-Release Checklist

- [ ] Test desktop app on clean machine
- [ ] Verify all sprite modes work
- [ ] Test server start/stop
- [ ] Check widget displays correctly in OBS
- [ ] Update version in `desktop-app/package.json`
- [ ] Update README if needed
- [ ] Build installer
- [ ] Create GitHub release with installer

## 🐛 Troubleshooting

**"electron-builder not found"**
```bash
cd desktop-app
npm install
```

**Build fails**
```bash
cd desktop-app
rm -rf node_modules
npm install
cd server
npm install
cd ..
npm run build:mac
```

**Missing icon files**
- Create `desktop-app/assets/icon.png` (512x512)
- Or the build will use a default icon

## 📝 Notes

- The desktop app bundles everything needed (Node.js, server, etc.)
- Users don't need to install anything except the app
- All data is stored locally
- Server runs on port 3000 automatically
