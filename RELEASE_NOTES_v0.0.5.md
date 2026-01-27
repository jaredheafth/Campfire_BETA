# 🔥 Campfire Widget v0.0.5 - Release Notes

## 🐛 Critical Fixes

### Update Installer Process Termination
- **Fixed update installer shutdown** - When updating from within the dashboard, the app now properly shuts down ALL processes (server, windows, tray) before running the installer, preventing "application is running" errors
- **Improved update flow** - Update installer waits for server process to fully terminate, destroys all windows and tray icon, then runs the installer cleanly

### END Button Process Termination
- **Fixed END button shutdown** - END button now properly terminates all processes (server, windows, tray) before quitting the app
- **Process cleanup** - Server process is force-killed after 1 second if it doesn't exit gracefully
- **Prevents file locks** - All processes are fully terminated before app quits, preventing installer detection issues

### Update Notifications
- **Fixed double 'v' prefix** - Update notifications no longer show "vv0.0.3", now correctly shows "v0.0.3"
- **Improved error messages** - Better error messages for update checks, including helpful hints when repository is private or releases aren't found
- **No duplicate notifications** - Fixed issue where update errors appeared twice

## ✨ Improvements

### Filename Consistency
- **Configured consistent naming** - Electron-builder now generates installer files with hyphens for consistency:
  - Windows: `Campfire-Widget-Setup-0.0.5.exe`
  - Mac Intel: `Campfire-Widget-0.0.5.dmg`
  - Mac ARM64: `Campfire-Widget-0.0.5-arm64.dmg`
- **Metadata matches filenames** - Auto-generated metadata files now match actual installer filenames, preventing download errors

### Company Metadata
- **Added company name** - "The Offline Club" is now set as the publisher/company name
- **Windows app properties** - Company name appears in Windows app properties under "Publisher"
- **Installer metadata** - Company name is included in installer metadata

## 📦 Installation

### Windows
1. Download `Campfire-Widget-Setup-0.0.5.exe`
2. Run the installer
3. Follow the installation wizard
4. Open "Campfire Widget" from Start Menu

### Mac
1. Download `Campfire-Widget-0.0.5.dmg` (Intel) or `Campfire-Widget-0.0.5-arm64.dmg` (Apple Silicon)
2. Open the DMG file
3. Drag "Campfire Widget" to Applications
4. Open from Applications folder

## 🔄 Updating from Previous Versions

If you're updating from v0.0.4 or earlier:
- Your settings will be preserved
- No manual migration needed
- **Important**: The update installer will now properly shut down all processes before installing, so you can update directly from within the dashboard using "Check for Updates"
- No need to manually close the app before updating

## 📝 Technical Details

### Changes in This Release
- Updated `install-update` handler to properly shut down all processes before running installer
- Fixed `stopServer()` to return Promise and wait for process termination
- Improved `shutdown-app` handler to wait for server termination
- Enhanced `before-quit` event to prevent quit until server stops
- Changed `win.close()` to `win.destroy()` for immediate termination
- Added company metadata "The Offline Club" to Windows build config
- Configured `artifactName` in electron-builder for consistent filename generation
- Fixed double 'v' prefix in update notifications by using DOM version directly
- Improved error handling and duplicate notification prevention

### Process Termination Flow
1. **END Button**: Stops server → Destroys windows → Destroys tray → Quits app
2. **Update Installer**: Stops server → Destroys windows → Destroys tray → Waits 1 second → Runs installer
3. **Before Quit**: Prevents quit until server is fully stopped

## 🎯 What's Next

Future improvements planned:
- Additional performance optimizations
- Enhanced update reliability
- More customization options

## 🐛 Known Issues

- None reported in this release

## 📊 Files Changed

- `desktop-app/main.js` - Process termination fixes, update installer shutdown, END button improvements
- `desktop-app/server/dashboard.html` - Update notification fixes, version display improvements
- `desktop-app/package.json` - Version bumped to 0.0.5, added company metadata, configured artifact names
- `dashboard.html` - Synced with desktop version (update notification fixes)

---

**Full Changelog**: See commit history for detailed changes
