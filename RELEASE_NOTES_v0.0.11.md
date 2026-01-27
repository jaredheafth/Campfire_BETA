# 🔥 Campfire Widget v0.0.11 - Desktop App

## ✨ Improvements

### Capture-Friendly Background Selector
- Added **Widget Background** setting in Dashboard → Perspective:
  - **Transparent**
  - **Black**
  - **White**
  - **Green Screen**
- The widget applies the background **live** (no restart required), so streamers can pick the best capture method per scene.

## 📋 Technical Details
- `desktop-app/server/dashboard.html`: added `widgetBackground` UI + saved setting
- `desktop-app/server/widget.html`: added `applyWidgetBackground()` + live updates via `settingsUpdate`

---

**Version**: 0.0.11  
**Release Date**: January 18, 2026  
**Compatibility**: Windows 10+, macOS 10.12+

