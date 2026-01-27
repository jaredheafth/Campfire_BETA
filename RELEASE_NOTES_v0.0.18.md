# 🔥 Campfire Widget v0.0.18 - Desktop App

## 🐛 Fixes

### Windows updater reliability (unsigned builds)
- Fixed auto-updates failing with “not signed by the application owner” by allowing unsigned NSIS updates on Windows (until we add code signing).

### Chat bubbles
- Chat bubbles now clamp to **3 lines max** and show `...` for overflow.

### Animations
- Fixed a visible “flash” before spin/swivel animations.
- Nameplates no longer flash during swivel animations; only the sprite animates.

### Dashboard settings
- Fixed default sprite direction getting stuck on **Left** (Right now persists correctly).

### Bot account
- Bot account commands now work reliably.
- “System-style” bot messages (like `username dances!`) remain suppressed from chat bubbles.

---

**Version**: 0.0.18  
**Release Date**: January 19, 2026  
**Compatibility**: Windows 10+, macOS 10.12+

