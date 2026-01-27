# ✅ v0.0.1 Release Checklist

## Pre-Release Verification

### ✅ Version Number
- **package.json**: `"version": "0.0.1"` ✓
- **Installers**: Named with `0.0.1` ✓
- **Git commits**: All changes committed ✓

### ✅ Installers Ready
- **Windows**: `Campfire Widget Setup 0.0.1.exe` (72MB) ✓
- **Mac Intel**: `Campfire Widget-0.0.1.dmg` (95MB) ✓
- **Mac Apple Silicon**: `Campfire Widget-0.0.1-arm64.dmg` (89MB) ✓

### ✅ Files Synced
- `dashboard.html` ↔ `desktop-app/server/dashboard.html` ✓
- `widget.html` ↔ `desktop-app/server/widget.html` ✓
- `server.js` ↔ `desktop-app/server/server.js` ✓

### ✅ Features Included
- **Version display**: Shows `0.0.1` in dashboard header ✓
- **END button**: Moved to far right ✓
- **Check for Updates**: Button added next to END button ✓
- **Sprite fix**: `extraFiles` configuration included ✓
- **Auto-updater**: Manual check button works ✓
- **Shutdown functionality**: END button fully functional ✓

### ✅ Sprite Verification
- **31 sprite GIF files** in `desktop-app/server/sprites/defaults/` ✓
- **Setup script verification** added ✓
- **extraFiles configuration** for sprite inclusion ✓

---

## GitHub Release Steps

### 1. Go to GitHub Releases
- URL: `https://github.com/jaredheafth/offlineclub_widget_Campfire/releases`
- Click **"Draft a new release"** or **"Edit release"** (if editing existing)

### 2. Release Information

**Tag version:** `v0.0.1` (must match exactly)

**Release title:**
```
v0.0.1 - Beta Release with UI Improvements and Sprite Fix
```

**Description:**
```markdown
## 🔥 Campfire Widget v0.0.1 (Re-Release)

### ✨ What's New in This Release
- **UI Improvements**: END button moved to far right, Check for Updates button added
- **Sprite Fix**: Fixed sprite files not being included in installer
- **Manual Updates**: Users can now manually check for updates anytime
- **Version Display**: Shows current version in dashboard header

### 🎨 UI Changes
- **END Button**: Moved from left to far right of dashboard
- **Check for Updates**: New button next to END button for manual update checks
- **Better Layout**: Improved button organization and spacing

### 🐛 Bug Fixes
- **Sprite Inclusion**: Fixed sprites not being included in desktop installer
- **Sprite Verification**: Setup scripts now verify sprite copying before build
- **Auto-Updater**: Manual update checking now available

### 📦 Downloads

**Windows:**
- Download `Campfire Widget Setup 0.0.1.exe` (72MB)
- Run the installer
- Follow the installation wizard

**Mac Intel:**
- Download `Campfire Widget-0.0.1.dmg` (95MB)
- Open the DMG file
- Drag to Applications folder

**Mac Apple Silicon (M1/M2/M3):**
- Download `Campfire Widget-0.0.1-arm64.dmg` (89MB)
- Open the DMG file
- Drag to Applications folder

### 🆕 Features
- **Manual Update Check**: Click "Check for Updates" button to check anytime
- **Version Display**: See current version in dashboard header
- **Improved UI**: Better button layout and organization

### 🔧 Technical Changes
- Added `extraFiles` configuration for reliable sprite inclusion
- Enhanced setup scripts with sprite verification
- Improved update checker with manual trigger option

### ⚠️ Known Issues
- This is a beta/pre-release version
- Some features may be incomplete
- Report issues on GitHub

### 📋 Installation Notes
- Installers can update over existing installations
- User data (settings, sprites) is preserved during updates
- Requires Windows 10+ or macOS 10.12+
- Sprites should now be included in installation directory

### 🔄 Update Notes
If updating from v0.0.0:
- This release includes sprite files that were missing
- All settings and data will be preserved
- END button is now on the right side
- Use "Check for Updates" button to verify you're on the latest version

---

**Full Changelog:** [See commit history](https://github.com/jaredheafth/offlineclub_widget_Campfire/compare/v0.0.0...v0.0.1)
```

### 3. Upload Installers

**Upload these 3 files from `releases/` folder:**
1. `Campfire Widget Setup 0.0.1.exe` (Windows)
2. `Campfire Widget-0.0.1.dmg` (Mac Intel)
3. `Campfire Widget-0.0.1-arm64.dmg` (Mac Apple Silicon)

**Important:**
- Drag and drop all 3 files
- Wait for uploads to complete (they're large files, ~70-95MB each)
- Verify all 3 files are attached before publishing

### 4. Release Type
- **Release type**: `Release` (not Pre-release)
- This is a beta version but mark as Release for auto-updater

### 5. Publish
- **Review everything** (tag, title, description, files)
- **Click "Publish release"**

---

## Post-Release Verification

After publishing, verify:

1. ✅ Release page shows correct version (`v0.0.1`)
2. ✅ All 3 installers are downloadable
3. ✅ Release notes are correct
4. ✅ Installers download correctly
5. ✅ Auto-updater can detect the release (if updating from v0.0.0)

---

## What Users Should Do

1. **Download** the installer for their platform
2. **Install** over existing v0.0.0 (if installed) - data will be preserved
3. **Check version** in dashboard header (should show `0.0.1`)
4. **Verify sprites** are present in installation directory
5. **Use "Check for Updates"** button to verify auto-updater works

---

## Troubleshooting

### If installers won't upload:
- GitHub has a 100MB file size limit for releases
- Files are under limit (72MB, 89MB, 95MB) ✓
- If still issues, check GitHub's upload progress

### If auto-updater doesn't detect update:
- Ensure `latest.yml` files are generated (should be automatic)
- Verify tag is exactly `v0.0.1` (with 'v' prefix)
- Check that installers are attached to the release

### If sprites still missing:
- Verify `setup.sh` was run before building
- Check `desktop-app/server/sprites/defaults/` has 31 GIF files
- Rebuild installer if needed

---

**✅ Everything is ready for release!**
