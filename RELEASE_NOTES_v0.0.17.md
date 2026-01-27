# 🔥 Campfire Widget v0.0.17 - Desktop App

## 🐛 Fixes

### Campfire upload method toggle
- Fixed Campfire “Upload Method” toggle reverting unexpectedly.
- You can now switch between **URL** and **UPLOAD** reliably, even if an upload already exists (URL shows the warning instead of forcing Upload).

### Commands + chat bubbles for the connected account
- Fixed the connected main account (ex: `heafth`) not being able to use `!join` / `!leave` and not showing chat bubbles.
- Chat messages sent by the **separate chat-bot sender** remain suppressed from bubbles (so “username dances!” doesn’t appear above sprites).
- The connected account is always treated as “active” in member lists.

### Stability + visuals
- Joining/leaving no longer shifts the positions of other users already around the campfire.
- Swivel animations (enter/spin/dance/sprite-change) now animate the **sprite only**, not the username.

---

**Version**: 0.0.17  
**Release Date**: January 19, 2026  
**Compatibility**: Windows 10+, macOS 10.12+

