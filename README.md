# 🔥 Campfire Widget - BETA

An interactive Twitch widget that displays a campfire with viewers appearing around it when they use chat commands. Designed for OBS streaming software.

**Current Version**: 0.0.21  
**Platform**: Windows 10+, macOS 10.12+  
**Recommended**: Desktop Application (one-click installer)

---

## 🚀 Quick Start (Desktop App - Recommended)

### Installation

1. **Download** the installer from [GitHub Releases](https://github.com/jaredheafth/offlineclub_widget_Campfire/releases)
   - Windows: `Campfire-Widget-Setup-0.0.21.exe`
   - macOS: `Campfire Widget-0.0.21-x64.dmg`

2. **Install** and launch the app

3. **Connect to Twitch**
   - Click "Settings" → "Twitch"
   - Follow the OAuth login
   - Select your channel

4. **Configure** in the Dashboard
   - Upload custom campfire graphic
   - Set chat command (e.g., `!join`)
   - Adjust circle angle, sprite mode, etc.

5. **Add to OBS**
   - Copy the widget code from "Code" tab
   - In OBS, add Browser Source
   - Paste the code
   - Set size to 1920x1080 (or your resolution)

That's it! Users can now type `!join` in chat to appear in the widget.

---

## 🌐 Browser-Based Setup (Legacy/Optional)

If you want to host on your own web server instead of using the desktop app:

See [LEGACY_SERVER.md](LEGACY_SERVER.md) for instructions on running `server.js` locally or on Railway/Heroku.

---

## ✨ Features

### Core
- ✅ **Interactive widget** - Viewers appear in campfire when they chat
- ✅ **Custom graphics** - Upload your own campfire GIF/MP4
- ✅ **Adjustable circle** - Configure perspective (top-down to side view)
- ✅ **Sprite modes** - RPG, Circles, Pixel Morphs, Custom
- ✅ **Chat commands** - `!join`, `!leave`, `!color`, `!next`, `!back`, `!cw`, `!ccw`
- ✅ **Permissions** - Restrict by subscriber, VIP, moderator status
- ✅ **User persistence** - Save viewer preferences across sessions

### Desktop App (v0.0.21+)
- ✅ **One-click installer** - No setup required
- ✅ **Automatic updates** - Stays up to date
- ✅ **System tray** - Quick access from taskbar
- ✅ **Twitch integration** - Full OAuth support
- ✅ **Performance** - Native Electron app, smooth animations

---

## 📖 Documentation
}
```

## Customization

### Adding Custom Sprites

1. Host your sprite images online (Imgur, CDN, etc.)
2. In the widget code, modify the `addUser()` function to accept sprite URLs
3. Update the dashboard to allow sprite uploads

### Styling

All styles are in the `<style>` section of `widget.html`. You can customize:
- Colors
- Shapes
- Animations
- Fonts
- Sizes

## Technical Details

### Circle Math

The circle uses CSS `scaleY` transform to create the perspective effect:
- `angle = 0°`: `scaleY(1)` = perfect circle
- `angle = 90°`: `scaleY(0)` = line

User positions are calculated using trigonometry:
```javascript
---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [QUICK_START.md](QUICK_START.md) | Get started in 5 minutes |
| [desktop-app/BUILD_INSTRUCTIONS.md](desktop-app/BUILD_INSTRUCTIONS.md) | Build desktop app from source |
| [ERROR_HANDLING_STANDARD.md](ERROR_HANDLING_STANDARD.md) | Error handling patterns |
| [KEYTAR_IMPLEMENTATION.md](KEYTAR_IMPLEMENTATION.md) | Secure token storage |
| [AUTO_UPDATER_CONFIG.md](AUTO_UPDATER_CONFIG.md) | Configure auto-updates |
| [LEGACY_SERVER.md](LEGACY_SERVER.md) | Run as web server (optional) |
| [CHAT_INTEGRATION.md](CHAT_INTEGRATION.md) | Twitch chat commands reference |

---

## 🎮 Chat Commands

Users can control their appearance with these commands:

```
!join               - Join the campfire
!leave              - Leave the campfire
!color #RRGGBB      - Set custom color
!cw / !ccw          - Rotate clockwise/counter-clockwise
!next / !back       - Cycle through RPG sprites
!still              - Stop moving
```

---

## 🐛 Troubleshooting

### Desktop App Won't Start
1. Check Windows Defender/antivirus isn't blocking it
2. Try running `npm start` from `desktop-app` folder to see errors
3. Ensure you have Windows 10+ or macOS 10.12+

### Widget Not Appearing in OBS
1. Copy the widget code from Dashboard → Code tab
2. Add new Browser Source in OBS
3. Paste code into "URL" field
4. Set width/height to 1920x1080
5. Refresh the source

### Twitch Won't Connect
1. Check internet connection
2. Verify OAuth token in Settings
3. Confirm you selected the correct channel
4. Try logging out and back in

### Settings Not Saving
1. Check browser console for errors
2. Verify you clicked "Save Settings"
3. Try refreshing the dashboard

---

## 🔒 Privacy & Security

- ✅ No data sent to external servers (except Twitch API)
- ✅ OAuth tokens stored securely (v0.0.21+)
- ✅ Settings saved locally only
- ✅ Open source - review the code anytime

---

## 📊 Performance

- Optimized for 20-100 concurrent users
- Smooth 60 FPS animations
- Minimal CPU/GPU usage
- Mobile-friendly (responsive design)

---

## 🤝 Contributing

Found a bug or have a feature request?

1. Check [existing issues](https://github.com/jaredheafth/offlineclub_widget_Campfire/issues)
2. [Report new issue](https://github.com/jaredheafth/offlineclub_widget_Campfire/issues/new) with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/videos if helpful
   - System info (Windows/Mac version)

---

## 📝 Version History

- **v0.0.21** (Jan 2026): Bug fixes, performance improvements, IPC debouncing
- **v0.0.20** (Jan 2026): Sprite orientation fixes, flicker effect
- **v0.0.1+** (Dec 2025): Initial desktop app release

See [RELEASE_NOTES_v0.0.21.md](RELEASE_NOTES_v0.0.21.md) for latest changes.

---

## 💜 Credits

Built with:
- [Electron](https://www.electronjs.org/) - Desktop app framework
- [tmi.js](https://github.com/tmijs/tmi.js) - Twitch IRC client
- [Express](https://expressjs.com/) - Web server
- Inspired by [The Offline Club](https://twitter.com/theofflineclub)

---

## 📄 License

MIT License - Free to use and modify!

---

**Made with 🔥 for streamers**  
Questions? [Open an issue](https://github.com/jaredheafth/offlineclub_widget_Campfire/issues)
