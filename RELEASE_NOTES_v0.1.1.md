# Campfire Widget v0.1.1 Release Notes

## 🔥 Popout Chat & !who Command Update

This release brings significant improvements to the Popout Chat experience and introduces the new `!who` command for listing campfire members.

---

## ✨ New Features

### 💬 Popout Chat Improvements

#### Chat Message Persistence
- Messages now persist when the popout chat window is opened and closed
- Up to 100 messages are retained in memory
- No more losing chat history when switching windows!

#### Emoji Picker 😀
- New emoji picker button in the popout chat
- Organized by categories:
  - 😀 Smileys & Emotion
  - 👋 Gestures & People
  - ❤️ Hearts & Symbols
  - 🐱 Animals & Nature
  - 🍕 Food & Drink
  - ⚽ Activities
  - 🚗 Travel & Places
  - 💡 Objects
  - ✨ Symbols

#### Twitch Emote Picker 📺
- Access your Twitch emotes directly in the popout chat
- Three tabs:
  - **Global**: Twitch global emotes
  - **Channel**: Your channel's subscriber emotes
  - **My Emotes**: Emotes from channels you're subscribed to

---

### 🔥 !who Command

A new command that lists all users currently around the campfire with their status!

**Example Output:**
```
🔥 Around the campfire: 🔥 User1 • 😴 User2 • 👁️ User3
```

#### Fully Customizable
- **Header Message**: Change "🔥 Around the campfire:" to anything you want
- **User Format**: Customize how each user is displayed using placeholders:
  - `{icon}` - Status icon
  - `{username}` - User's display name
  - `{state}` - User's state (active, sleepy, afk, lurk)
- **Separator**: Change the separator between users (default: ` • `)
- **State Icons**: Customize the emoji for each state:
  - 🔥 Active/Joined
  - 😴 Sleepy
  - 💤 AFK
  - 👁️ Lurking
- **State Filters**: Choose which states to include/exclude

#### Smart Truncation
- If the message is too long for Twitch (450+ chars), it automatically shows a summary:
  ```
  🔥 15 campers: 8 active, 3 sleepy, 2 AFK, 2 lurking
  ```

---

### ⏱️ Command Cooldown System

All commands now support configurable cooldowns!

- **Global Cooldowns**: Shared across all users (great for !who)
- **Per-User Cooldowns**: Individual cooldown per user
- **Configurable Duration**: Set cooldown in seconds
- **UI Controls**: Toggle and configure in the Commands tab

---

### 🔥 APP Commands Tab

New "🔥 App" subtab in the Commands section for app-specific commands like `!who`.

---

## 🐛 Bug Fixes

- Fixed `!who` command not returning user data
- Fixed state icons and separator not saving properly
- Improved user state detection for accurate status display

---

## 📁 Files Included

| File | Platform | Size |
|------|----------|------|
| `Campfire-Widget-Setup-0.1.1.exe` | Windows x64 | ~72 MB |

---

## 📋 Installation

### Windows
1. Download `Campfire-Widget-Setup-0.1.1.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch Campfire Widget from the Start Menu or Desktop shortcut

### Upgrading from v0.1.0
- Your settings and preferences will be preserved
- Simply run the new installer over your existing installation

---

## 🔧 Technical Notes

- Built with Electron 27.3.11
- Requires Windows 10 or later (64-bit)
- Auto-update support included

---

## 📖 Documentation

- [APP_VISION.md](APP_VISION.md) - Comprehensive app vision and roadmap
- [CHANGELOG.md](CHANGELOG.md) - Full changelog
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) - Developer documentation

---

## 🙏 Thank You

Thank you for using Campfire Widget! Your feedback helps make the app better for everyone.

**Report Issues**: [GitHub Issues](https://github.com/jaredheafth/Campfire_BETA/issues)

---

*Developed by The Offline Club*
