# 🔥 Campfire Widget v0.0.0 - Desktop App (Beta/Pre-Release)

⚠️ **This is a pre-release for testing purposes. Please report any issues!**

## What's New

- ✅ Full desktop app with installer
- ✅ Automatic server startup
- ✅ System tray integration
- ✅ Built-in dashboard
- ✅ Twitch chat integration
- ✅ Viewer dashboard for customization
- ✅ Sprite system with animations
- ✅ Member management (mute, still, kick)
- ✅ User persistence across sessions
- ✅ Smooth animations and proper layering

## Installation

### Windows
1. Download `Campfire Widget Setup 0.0.0.exe`
2. Run the installer
3. Follow the installation wizard
4. Open "Campfire Widget" from Start Menu
5. Configure your settings in the dashboard

### Mac
1. Download `Campfire Widget-0.0.0.dmg` (Intel) or `Campfire Widget-0.0.0-arm64.dmg` (Apple Silicon)
2. Open the DMG file
3. Drag "Campfire Widget" to Applications
4. Open from Applications folder
5. Configure your settings in the dashboard

## First Time Setup

1. **Open the app** - Server starts automatically
2. **Configure Twitch** - Edit `server.js` in the app directory with your Twitch credentials:
   - Get OAuth token from: https://twitchtokengenerator.com/
   - Scope needed: `chat:read`
   - Update `BOT_USERNAME`, `OAUTH_TOKEN`, and `CHANNEL_NAME` in `server.js`
3. **Restart the app** to apply Twitch settings
4. **Open Dashboard** - Click "Open Dashboard" in the app
5. **Configure Settings** - Upload campfire graphic, set permissions, etc.
6. **Get Widget Code** - Copy code from "Code" tab
7. **Add to OBS** - Use Browser Source with `http://localhost:3000/widget.html`

## Features

- 🎨 Custom campfire graphics (GIF/video)
- 👥 Viewer sprites around campfire
- 💬 Chat integration (`!join` command)
- 🎭 Sprite animations and customization
- 👑 Permission system (subs, VIP, mods)
- 🎛️ Streamer dashboard for control
- 👤 Viewer dashboard for customization
- 🔇 Member management (mute, still, kick)
- 💾 User persistence (users stay after refresh)
- ✨ Smooth animations and proper layering

## System Requirements

- **Windows**: Windows 10 or later
- **Mac**: macOS 10.13 or later
- **Internet**: Required for Twitch chat (widget works offline otherwise)

## Support

- Report issues on GitHub
- Check documentation in the repository

## Known Issues / Testing Notes

This is a beta release. Please test and report:
- Installation process
- App startup and server launch
- Dashboard functionality
- Widget display in OBS
- Twitch chat integration
- Any crashes or errors

## Changelog

### v0.0.0 (Beta/Pre-Release)
- Initial desktop app pre-release for testing
- Full installer support (Windows & Mac)
- System tray integration
- All core features implemented
- User persistence
- Member management
- Sprite system with animations
