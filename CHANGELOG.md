# Changelog

## [0.1.1] - 2026-01-27 - Popout Chat & !who Command Update

### Added
- ✨ **Chat Message Persistence**: Popout chat now retains messages when opened/closed (up to 100 messages)
- ✨ **Emoji Picker**: New emoji picker in popout chat with categorized emojis (Smileys, Gestures, Hearts, Animals, Food, Activities, Travel, Objects, Symbols)
- ✨ **Twitch Emote Picker**: Access Global, Channel, and Subscribed emotes directly in popout chat
- ✨ **!who Command**: New command to list all users around the campfire with their status
- ✨ **Command Cooldowns**: All commands now support configurable cooldowns (global or per-user)
- ✨ **APP Commands Tab**: New "🔥 App" subtab in Commands for app-specific commands like !who

### !who Command Features
- 🔥 Customizable header message (e.g., "🔥 Around the campfire:")
- 🔥 Customizable user format with placeholders: `{icon}`, `{username}`, `{state}`
- 🔥 Customizable separator between users (default: ` • `)
- 🔥 Editable state icons for each status (Active, Sleepy, AFK, Lurking)
- 🔥 State filters to include/exclude specific user states
- 🔥 Live preview in dashboard
- 🔥 Inline output format for Twitch chat compatibility
- 🔥 Automatic truncation for long lists (shows summary counts)

### Cooldown System
- ⏱️ Global cooldowns (shared across all users)
- ⏱️ Per-user cooldowns (individual cooldown per user)
- ⏱️ Configurable cooldown duration in seconds
- ⏱️ UI controls in Commands tab for all commands

### Technical
- 🔧 Added `stateIcons`, `stateFilters`, `userSeparator`, `userLineFormat` properties to !who command
- 🔧 Added `commandCooldowns` Map for tracking cooldown state
- 🔧 Added `chatMessageHistory` array for popout chat persistence
- 🔧 Updated `normalizeBotMessage()` to preserve !who-specific properties
- 🔧 Added IPC handlers for emote fetching and chat history

---

## [Unreleased] - User Persistence Refactor

### Changed
- 🔄 **User Persistence Disabled**: Removed user persistence across app restarts for cleaner state management
- 🔄 **Clean Startup**: App now starts with a fresh user list each time, eliminating stale user data issues
- 🔄 **Account Initialization**: Streamer and bot accounts now initialize in 'joined' state (yellow pulse) on startup
- 🔄 **State Management**: Users start in 'joined' state and transition to 'active' only when they chat or use commands

### Technical
- 🔧 Modified `loadPersistedUsers()` to clear persisted data on startup
- 🔧 Updated `savePersistedUsers()` to no-op (disabled persistence)
- 🔧 Added `initializeStreamerAccount()` and `addStartupUser()` for clean account setup
- 🔧 Added `getBotUsername()` to initialize bot account when different from streamer
- 🔧 Removed persistence calls from user management functions

## [0.0.1] - Pre-Release Testing

### Added
- ✅ Desktop app with full installer support (Windows & Mac)
- ✅ Sprite file copying to desktop app build
- ✅ Improved sprite loading with blob URL handling
- ✅ Better error handling for sprite loading failures
- ✅ OAuth token generation fix (prevents false "window closed" errors)
- ✅ System tray integration
- ✅ Automatic server startup
- ✅ Member management (mute, still, kick)
- ✅ User persistence across sessions
- ✅ Test users for demonstration

### Fixed
- ✅ Sprite visibility on Windows (blob URL handling)
- ✅ Sprite loading timeout protection
- ✅ Memory leaks from unrevoked blob URLs
- ✅ OAuth window close error when navigation succeeds
- ✅ Circle outline appearing around sprites

### Changed
- ✅ Improved sprite loading with better error handling
- ✅ Sprite animation fade-in on load
- ✅ Better fallback handling for sprite loading failures

### Technical
- ✅ Setup scripts now copy sprite files to desktop app
- ✅ Server files synced between main and desktop-app versions
- ✅ All fixes applied to both desktop and hosted versions
