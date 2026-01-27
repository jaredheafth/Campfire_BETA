# Release Notes v0.1.0 - BETA

## Release Date: January 26, 2026

## 🎉 First Beta Release!

This is the first public beta release of Campfire Widget. Thank you for testing!

---

## What's New in Beta

### Core Features
- **Twitch Chat Integration** - Connect to your Twitch channel and let viewers join the campfire
- **Sprite System** - Animated pixel art characters that represent viewers
- **Chat Commands** - `!join`, `!leave`, `!spin`, `!dance`, `!sparkle`, `!cw`, `!ccw`, `!next`, `!back`
- **Transparent Background Mode** - Use as OBS browser source with transparent background
- **Desktop Application** - Standalone Windows app with built-in server

### Recent Improvements (from Alpha)
- **Fixed Menu Bar Buttons** - Buttons now click reliably in transparent mode
- **Proactive Chat Colors** - Streamer/bot accounts show correct Twitch colors immediately
- **Bot Account Status Indicator** - Clear visual feedback for bot account configuration
- **Improved UX** - Better status indicators and explanatory text

---

## System Requirements

- **Windows 10/11** (64-bit)
- **Internet connection** for Twitch integration
- **Twitch account** with OAuth token

---

## Installation

1. Download `Campfire-Widget-Setup-0.1.0.exe`
2. Run the installer
3. Launch Campfire Widget
4. Configure your Twitch credentials in the Twitch tab
5. Add the widget URL to OBS as a browser source

---

## Known Issues

- Bot account Connect/Disconnect button may show incorrect state after restart (cosmetic only - functionality works)
- Some movement commands (wander, roam, still) are not yet implemented
- Some state commands (afk, lurk) are not yet implemented

---

## Feedback

This is a beta release! Please report any bugs or issues you encounter.

---

## OAuth Scopes Required

### Main Account (Streamer)
- `chat:read` – Read chat messages
- `chat:edit` – Send chat messages
- `channel:read:subscriptions` – Read subscriber information
- `moderator:read:chatters` – Read list of chatters in channel
- `user:read:chat` – Read user chat colors

### Bot Account (if using separate bot)
- `chat:read` – Read chat messages
- `chat:edit` – Send chat messages
