# 🔥 Campfire Widget v0.0.14 - Desktop App

## ✅ Changes since v0.0.10

### Capture & Window Control
- Added **Widget Background** capture options (Transparent / Black / White / Green Screen).
- Added a **Title Bar (native frame)** toggle, with guardrails for Windows + transparency stability.

### Chat, Emotes, and Controls
- Added **third‑party emote rendering** support (BTTV / FFZ / 7TV) in chat bubbles.
- Suppressed chat bubbles for **command messages** (anything starting with `!`).
- Added additional chat commands: `!help`, `!random`, `!reset`, `!spin`, `!dance`, `!still`, `!wander`, `!next`, `!back`.
- Added **Mute chat bubbles** + badge whitelist (VIP / MOD / T1 / T2 / T3).
- Added **Hide nameplates** toggle (hide/show usernames above sprites).

### Members & Sync
- Improved member list sync + deduplication across Dashboard / Members window / Widget.
- Added richer member states (Joined / Active in chat / Sleeping / Not joined) + icons.
- Added **Kick All** + **Join All** bulk actions with confirmations and staggered joins.

## 🐛 Fixes (new in v0.0.14)
- Fixed **TestUsers** instantly leaving after joining.
- `!cw` / `!ccw` now move **exact degrees** and **animate smoothly** around the campfire orbit (no “teleport/jump” feel).
- Removed extra hint text: `(auto-fills from Channel Name - click to edit)`.
- Added a clear **Chat Bot status** line in the Twitch connection status box.
- Messages sent by the app’s sending account (ex: `username dances!`) **no longer render as chat bubbles**.
- Reduced Windows lag by **throttling** high-frequency member list sync updates from Twitch chat.

---

**Version**: 0.0.14  
**Release Date**: January 18, 2026  
**Compatibility**: Windows 10+, macOS 10.12+

