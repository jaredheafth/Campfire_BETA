# Release Notes - v0.0.6

## 🎯 Major Improvements

### ✨ Settings UI with Manual Sprite Path Override
- **New Settings Gear Icon** (⚙️) in the top-right corner of the dashboard
- **Manual Path Selection**: Users can now browse and select a custom folder for default sprites
- **Path Display**: Shows current sprite path (custom or default) with clear indicators
- **Reset Option**: Easily reset to auto-detected default path
- **Server Restart Prompt**: Automatically offers to restart server after path changes

### 🔧 Enhanced Sprite Path Resolution
- **Cross-Platform Support**: Improved path detection for Windows, Mac, and Linux
- **Priority System**: 
  1. Custom user-selected path (if set)
  2. Unpacked directory (`app.asar.unpacked`) for packaged apps
  3. Asar archive path (fallback)
  4. Development path (dev mode)
- **Environment Variable Passing**: Main process now passes sprite path to server via `CUSTOM_SPRITE_PATH`
- **Persistent Storage**: Custom paths saved in Electron's userData directory

### 🐛 Bug Fixes

#### Sprite Loading
- **Fixed Async/Await**: Made `initializeDashboard()` async and properly await all sprite loading functions
- **Better Error Handling**: Comprehensive error messages showing attempted URLs and HTTP status codes
- **Improved Logging**: Server now logs detailed path resolution information for debugging

#### Path Detection
- **Windows Path Handling**: Proper handling of Windows path separators and `app.asar.unpacked` structure
- **Mac Path Handling**: Correct detection of unpacked files on macOS
- **Path Validation**: Server verifies sprite directory structure before serving files

### 📊 Debugging Improvements
- **Server Console Logs**: Detailed path resolution debugging showing:
  - `__dirname` path
  - Unpacked directory detection
  - Sprite directory existence checks
  - File count verification
- **Browser Console Logs**: Fetch attempts with full URLs for troubleshooting
- **Clear Error Messages**: HTTP status codes and descriptive error messages

### 🎨 UI/UX Improvements
- **Settings Modal**: Clean, spacious layout with improved spacing
- **Path Display**: Monospace font for better readability of file paths
- **Visual Feedback**: Clear indicators for custom vs. default paths
- **User-Friendly Messages**: Helpful notifications and confirmations

## 📋 Technical Details

### Files Changed
- `desktop-app/main.js`: Added sprite path management functions and IPC handlers
- `desktop-app/preload.js`: Added sprite path management APIs
- `desktop-app/server/server.js`: Enhanced path resolution with priority system
- `desktop-app/server/dashboard.html`: Added settings UI and improved sprite loading

### New Features
- `getDefaultSpritePath()`: Cross-platform default path detection
- `getCustomSpritePath()`: Retrieves user-selected custom path
- `getEffectiveSpritePath()`: Returns the path that should be used (custom or default)
- IPC handlers: `get-sprite-path`, `set-sprite-path`, `reset-sprite-path`
- Settings modal with folder browser integration

### Path Resolution Logic
```javascript
Priority 1: Custom path (user-selected via Settings)
Priority 2: Unpacked path (app.asar.unpacked/server/sprites)
Priority 3: Asar path (app.asar/server/sprites)
Priority 4: Development path (__dirname/sprites)
```

## 🚀 Installation & Update

### For New Users
1. Download the installer for your platform:
   - **Windows**: `Campfire Widget-Setup-0.0.6.exe`
   - **Mac Intel**: `Campfire Widget-0.0.6-x64.dmg`
   - **Mac Apple Silicon**: `Campfire Widget-0.0.6-arm64.dmg`
2. Run the installer and follow the setup wizard
3. Launch the app - sprites should load automatically

### For Existing Users (v0.0.5 and earlier)
1. Open the dashboard
2. Click **"🔄 Check for Updates"** button
3. When prompted, download and install v0.0.6
4. The app will automatically restart with the new version

### If Sprites Don't Load
1. Click the **⚙️ Settings** icon in the top-right corner
2. Check the displayed sprite path
3. If incorrect, click **"📁 Browse Folder"** and select your sprites folder
   - Should contain a `defaults` subfolder with `rpg-characters`, `circles`, and `pixel-morphs`
4. Click **"🔄 Reset to Default"** if you want to use auto-detection again
5. Restart the server when prompted

## 🔍 Troubleshooting

### Sprites Not Visible
1. **Check Server Console**: Look for path resolution messages
   - Should show: `✅ Using unpacked sprites from: [path]`
   - Or: `✅ Using custom sprite path from Electron: [path]`
2. **Check Browser Console** (F12): Look for fetch errors
   - Should show: `🔄 Loading RPG sprites from: http://localhost:3000/sprites/defaults/rpg-characters/`
3. **Use Settings Override**: If auto-detection fails, manually set the path via Settings ⚙️

### Path Issues
- **Windows**: Paths should use backslashes (handled automatically)
- **Mac**: Paths should use forward slashes (handled automatically)
- **Custom Path**: Must contain a `defaults` folder with sprite subfolders

### Server Logs
The server now provides detailed logging:
```
🔍 Path resolution debug:
  __dirname: [path]
  CUSTOM_SPRITE_PATH: [path or undefined]
  ✅ Using unpacked sprites from: [path]
  ✅ Serving sprites from: [path]
```

## 📦 What's Included

- ✅ Windows installer (x64)
- ✅ Mac installer (Intel x64)
- ✅ Mac installer (Apple Silicon ARM64)
- ✅ Auto-update metadata files (`latest.yml`, `latest-mac.yml`)

## 🎉 What's Next

This version focuses on reliability and user control. If sprite paths still don't work automatically, the Settings UI provides a manual override option. Future versions will continue to improve auto-detection based on user feedback.

---

**Version**: 0.0.6  
**Release Date**: January 16, 2026  
**Compatibility**: Windows 10+, macOS 10.12+
