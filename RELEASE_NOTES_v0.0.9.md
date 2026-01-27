# 🔥 Campfire Widget v0.0.9 - Desktop App

## 🐛 Critical Fixes

### Windows “White Screen” on Launch
- **Fixed Windows blank/white window** by keeping hardware acceleration enabled on Windows
- Hardware acceleration is now disabled **only on macOS** (where it resolves transparent-window ghosting)

## 📋 Technical Details
- `desktop-app/main.js`: gate `app.disableHardwareAcceleration()` behind `process.platform === 'darwin'`

---

**Version**: 0.0.9  
**Release Date**: January 18, 2026  
**Compatibility**: Windows 10+, macOS 10.12+

