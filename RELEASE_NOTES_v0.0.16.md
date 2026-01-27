# 🔥 Campfire Widget v0.0.16 - Desktop App

## 🐛 Fixes

### Updater reliability (Windows + macOS)
- Fixed update installs getting stuck on “please close the app” by enforcing a **true full shutdown** path:
  - Closing the **Visual Display** now quits the entire app (no invisible background process).
  - The **END** button now shuts down **all windows + Twitch connections** (including the separate chat-bot client) before exit.
  - The updater now uses the same full shutdown behavior before running the installer.

### UI responsiveness
- Fixed **Fire Size** + **Sprite Size** sliders reverting by ensuring size changes are actually saved/broadcast to the desktop app in real time.
- Improved Viewer Dashboard movement responsiveness by making movement updates **non-blocking** (no waiting on network calls to move locally).

---

**Version**: 0.0.16  
**Release Date**: January 18, 2026  
**Compatibility**: Windows 10+, macOS 10.12+

