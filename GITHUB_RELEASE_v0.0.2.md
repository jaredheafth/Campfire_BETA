# 📋 GitHub Release v0.0.2 - Form Information

## Release Form Fields

### Tag version:
```
v0.0.2
```
(Important: Must match exactly with 'v' prefix. Create new tag on publish)

### Release title:
```
v0.0.2 - Critical Sprite Fix & UI Improvements
```

---

### Description (Copy this entire section):

```markdown
## 🔥 Campfire Widget v0.0.2

### 🐛 CRITICAL FIX - Sprites Now Included
- **Sprite Inclusion Fix**: Fixed sprites not being included in desktop installer
- **Used `asarUnpack`**: Sprites now extracted to `app.asar.unpacked/server/sprites/`
- **Server Path Resolution**: Updated server to check both asar and unpacked locations
- **Verified**: 31 sprite files (20 ADVENTURERS, 10 MORPHS, 1 SHADOW) now included

### ✨ What's New
- **UI Improvements**: END button moved to far right, Check for Updates button added
- **Sprite Mode Renames**: Circles→SHADOWS, RPG Characters→ADVENTURERS, Pixel Morphs→MORPHS
- **Hidden Uploads**: Upload option removed for default sprites (preloaded with installer)
- **Version Display**: Shows current version (v0.0.2) in dashboard header
- **Manual Updates**: Users can now manually check for updates anytime

### 🎨 UI Changes
- **END Button**: Moved from left to far right of dashboard
- **Check for Updates**: New button next to END button for manual update checks
- **Better Layout**: Improved button organization and spacing
- **Sprite Uploads**: Only CUSTOM mode shows upload option (default sprites are preloaded)

### 📦 Downloads

**Windows:**
- Download `Campfire Widget Setup 0.0.2.exe` (72MB)
- Run the installer
- Follow the installation wizard

**Mac Intel:**
- Download `Campfire Widget-0.0.2.dmg` (95MB)
- Open the DMG file
- Drag to Applications folder

**Mac Apple Silicon (M1/M2/M3):**
- Download `Campfire Widget-0.0.2-arm64.dmg` (89MB)
- Open the DMG file
- Drag to Applications folder

### 🆕 Features
- **Manual Update Check**: Click "Check for Updates" button to check anytime
- **Version Display**: See current version in dashboard header
- **Improved UI**: Better button layout and organization
- **Preloaded Sprites**: Default sprites (SHADOWS, ADVENTURERS, MORPHS) included automatically

### 🔧 Technical Changes
- Changed from `extraFiles` to `asarUnpack` for sprite inclusion
- Sprites extracted to `app.asar.unpacked/server/sprites/` (accessible via file system)
- Server updated to check both `app.asar` and `app.asar.unpacked` locations
- Enhanced setup scripts with sprite verification

### ⚠️ Known Issues
- This is a beta/pre-release version
- Some features may be incomplete
- Report issues on GitHub

### 📋 Installation Notes
- Installers can update over existing installations (v0.0.1 → v0.0.2)
- User data (settings, sprites) is preserved during updates
- Requires Windows 10+ or macOS 10.12+
- **Sprites are now included** - check `app.asar.unpacked/server/sprites/defaults/` after installation

### 🔄 Update Notes
If updating from v0.0.1:
- ✅ **Sprites are now included** - this was the critical fix
- ✅ END button is now on the right side
- ✅ Sprite modes renamed: SHADOWS, ADVENTURERS, MORPHS, CUSTOM
- ✅ Upload option hidden for default sprites
- ✅ Use "Check for Updates" button to verify you're on the latest version

If updating from v0.0.0:
- ✅ Sprites are now included
- ✅ All improvements from v0.0.1 included
- ✅ All settings and data will be preserved

### 🔍 Verification After Installation

After installing, verify sprites are included:

**Windows:**
```
C:\Users\[YourUsername]\AppData\Local\Programs\campfire-widget-desktop\resources\app.asar.unpacked\server\sprites\defaults\
```

**Mac:**
```
/Applications/Campfire Widget.app/Contents/Resources/app.asar.unpacked/server/sprites/defaults/
```

You should see:
- `rpg-characters/` folder with 20 GIF files (ADVENTURERS)
- `pixel-morphs/` folder with 10 GIF files (MORPHS)
- `circles/` folder with 1 GIF file (SHADOWS)
- Total: 31 sprite files

---

**Full Changelog:** [See commit history](https://github.com/jaredheafth/offlineclub_widget_Campfire/compare/v0.0.1...v0.0.2)
```

---

### Installers to Upload

Upload these 3 files from `releases/` folder:

1. ✅ `Campfire Widget Setup 0.0.2.exe` (Windows) - 72MB
2. ✅ `Campfire Widget-0.0.2.dmg` (Mac Intel) - 95MB
3. ✅ `Campfire Widget-0.0.2-arm64.dmg` (Mac Apple Silicon) - 89MB

---

### Release Settings

- **Release type**: ✅ **Release** (not Pre-release)
- **Tag version**: `v0.0.2` (with 'v' prefix)
- **Target**: `main` branch
- **Create new tag**: `v0.0.2` on publish

---

## Quick Checklist

- [ ] Tag: `v0.0.2`
- [ ] Title: `v0.0.2 - Critical Sprite Fix & UI Improvements`
- [ ] Description: Copy the markdown above
- [ ] Upload all 3 installers (0.0.2 versions)
- [ ] Mark as **Release** (not Pre-release)
- [ ] Publish release

---

**Ready to publish! 🚀**
