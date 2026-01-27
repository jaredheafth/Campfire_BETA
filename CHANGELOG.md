# Changelog

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
