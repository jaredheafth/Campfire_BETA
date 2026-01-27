# 🔥 Campfire Widget v0.0.3 - Release Notes

## 🐛 Bug Fixes

### Critical Fixes
- **Fixed infinite loop in settings updates** - Resolved issue where `updateSettings` was causing continuous console spam and performance issues
- **Fixed empty squares appearing before sprites load** - Elements are now completely hidden until sprites are fully loaded, preventing any visual artifacts
- **Fixed inconsistent animations** - Sprite entry/exit animations now work consistently when toggling test users or switching sprite modes
- **Fixed sprite switching** - When changing sprite modes, elements properly hide during the transition and show with smooth animations when new sprites load

### Stability Improvements
- **Prevented duplicate function calls** - Added guards to prevent multiple simultaneous calls to `setupMockUsers()` and `startRandomMovement()`
- **Improved error handling** - Better handling of sprite load failures and timeouts

## ✨ UI/UX Improvements

### Dashboard Enhancements
- **Reorganized header buttons** - All buttons in "How to Use" container now aligned to the far right
- **Button order**: Show Test Users → Check for Updates → Repair → END
- **Changed "Save" to "Apply"** - More intuitive button labeling
- **Repair button styling** - Now blue for better visual distinction
- **Reordered Preview buttons**: Reset → Test → Apply

### Notification System
- **Fade-in/fade-out notifications** - Settings saved notification now fades in and out automatically (no OK button required)
- **Confirmation popup for Reset** - Reset button now uses a confirmation dialog similar to the viewer dashboard's "Leave" flow
- **Consistent UX** - Matches the notification style from the viewer dashboard

### Version Display
- **Version prefix** - Version now displays with 'v' prefix (e.g., "v0.0.3")

## 📦 Installation

### Windows
1. Download `Campfire Widget Setup 0.0.3.exe`
2. Run the installer
3. Follow the installation wizard
4. Open "Campfire Widget" from Start Menu

### Mac
1. Download `Campfire Widget-0.0.3.dmg` (Intel) or `Campfire Widget-0.0.3-arm64.dmg` (Apple Silicon)
2. Open the DMG file
3. Drag "Campfire Widget" to Applications
4. Open from Applications folder

## 🔄 Updating from Previous Versions

If you're updating from v0.0.2 or earlier:
- Your settings will be preserved
- No manual migration needed
- Simply install the new version over the old one

## 📝 Technical Details

### Changes in This Release
- Fixed `updateSettings` infinite loop with guard flags and conditional localStorage writes
- Improved sprite loading logic to prevent empty squares from ever being visible
- Enhanced `updateUserElement` to match `createUserElement` animation behavior
- Added notification and confirmation popup systems to dashboard
- Improved code stability with better error handling and duplicate call prevention

## 🎯 What's Next

Future improvements planned:
- Additional sprite loading optimizations
- Enhanced animation system
- More customization options

## 🐛 Known Issues

- None reported in this release

## 📊 Files Changed

- `widget.html` - Sprite loading, animation fixes, infinite loop fix
- `dashboard.html` - UI improvements, notification system
- `desktop-app/package.json` - Version bumped to 0.0.3

---

**Full Changelog**: See commit history for detailed changes
