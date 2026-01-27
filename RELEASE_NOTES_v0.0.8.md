# 🔥 Campfire Widget v0.0.8 - Desktop App

## 🐛 Critical Fixes

### macOS Transparent Window Ghosting
- **Fixed lingering sprite/username outlines** on transparent windows (macOS) by disabling hardware acceleration
- **Cleaner compositing** - reduces stale pixel artifacts during animations and UI transitions

### Sprite Mode Switching Reliability
- **Fixed sprite mode not updating** when switching modes (user saved RPG sprite no longer overrides global mode)
- **RPG persistence preserved** - saved RPG selection still applies when RPG mode is active

### Members List Sync + Deduplication
- **Fixed members list desync** (widget members tab updates when chatters list changes)
- **Fixed duplicate names** across dashboard/members/widget lists via improved merging + dedupe logic

## ✨ Improvements

### Campfire Placement Control
- **New “Campfire Vertical Offset” slider** in Dashboard → Perspective
- Range **0–100** with **50 = centered** (lets you visually dial in any custom fire graphic)

### Better “At-a-Glance” Member Status
- Members now display clear status states:
  - **Joined** (in campfire)
  - **Active in chat** (recent activity window)
  - **Not joined** (seen in chat, not in campfire)
  - **Sleeping / Restored** (persisted in widget but no longer active in chat)
- **Gentle pulse + `zzz` animation** for sleeping/disconnected users

### Bulk Campfire Controls
- Added **☁️ Kick All** and **🔥 Join All** controls
- **Confirm prompts** to prevent mistakes
- **Join All mode selector**:
  - **Controlled** (respects join restrictions)
  - **Chaos** (override / bring everyone in)
- **Staggered joins** to reduce spikes and keep animations smooth

### Chat Bubble + Emotes
- **Pixel-style chat bubble borders** (retro “Gameboy”-style)
- **Chat bubbles track username positioning** (stays aligned even when sprite size/mode changes)
- **Third-party emotes supported** (BTTV / FFZ / 7TV) for channel emote codes that don’t appear in Twitch IRC `tags.emotes`
- **Emotes render larger** inside chat bubbles for readability

## 📋 Technical Details

### Changes in This Release
- Disabled GPU acceleration for macOS transparent window stability
- Added third-party emote fetching + caching + widget rendering
- Added widget-display user syncing for accurate members lists (including persisted users)
- Added bulk join/kick IPC + UI wiring (widget + dashboard)
- Added campfire vertical offset setting + live preview updates

### Files Changed (high level)
- `desktop-app/main.js`, `desktop-app/preload.js`
- `desktop-app/server/widget.html`
- `desktop-app/server/dashboard.html`
- `desktop-app/server/members-window.html`
- `desktop-app/server/viewer-dashboard.html`

## 🚀 Installation & Update

### For New Users
1. Download the installer for your platform:
   - **Windows**: `Campfire-Widget-Setup-0.0.8.exe`
   - **Mac Intel**: `Campfire-Widget-0.0.8-x64.dmg`
   - **Mac Apple Silicon**: `Campfire-Widget-0.0.8-arm64.dmg`
2. Run the installer and follow the setup wizard
3. Launch the app

### For Existing Users (v0.0.7 and earlier)
1. Open the dashboard
2. Click **"🔄 Check for Updates"**
3. Install v0.0.8 when prompted
4. The app will restart into the new version

### Important Notes
- **Windows Security Warning**: Since installers are not code-signed, Windows may show a warning. This is expected—click “More info” → “Run anyway”.

## 📦 What's Included

- ✅ Windows installer (x64) - `Campfire-Widget-Setup-0.0.8.exe`
- ✅ Mac installer (Intel x64) - `Campfire-Widget-0.0.8-x64.dmg`
- ✅ Mac installer (Apple Silicon ARM64) - `Campfire-Widget-0.0.8-arm64.dmg`
- ✅ Auto-update metadata files (`latest.yml`, `latest-mac.yml`)

## 🎯 What's Next

Planned improvements:
- App icon + branding polish (installer/app icons)
- Optional code signing for production releases (reduces Windows warnings)
- Continued UX polish for chat + member management

---

**Version**: 0.0.8  
**Release Date**: January 18, 2026  
**Compatibility**: Windows 10+, macOS 10.12+

