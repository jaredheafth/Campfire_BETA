# 🔥 Campfire Widget v0.0.4 - Release Notes

## 🐛 Bug Fixes

### Critical Fixes
- **Fixed sprite loading in desktop app** - Sprites were not loading due to incorrect paths. Changed from relative paths to absolute paths (`/sprites/...`) to work correctly with the Electron app's server structure
- **Fixed server sprite serving** - Server now always mounts `/sprites` route correctly, ensuring sprites are accessible from `app.asar.unpacked/server/sprites/`
- **Fixed duplicate update notifications** - Resolved issue where "Check for Updates" showed error notifications twice
- **Removed unnecessary PNG sprite sheets** - PNG source files are now excluded from the desktop app build, reducing installer size

### Auto-Updater Improvements
- **Improved error messages** - Better error messages for update checks, including helpful hints when repository is private or releases aren't found
- **Fixed update checker setup** - Added guard to prevent duplicate listener registration

## ✨ UI/UX Improvements

### Update System
- **Better error handling** - Update check errors now show helpful messages explaining what to check (repository visibility, releases, etc.)
- **Prevented duplicate listeners** - Update checker now prevents multiple listener registrations

## 🔧 Technical Improvements

### Path Resolution
- **Absolute sprite paths** - All sprite fetches now use absolute paths starting with `/sprites/` for reliable loading in both web and desktop app contexts
- **Consistent sprite serving** - Server always mounts `/sprites` route from the correct unpacked directory
- **Build optimizations** - Excluded PNG sprite sheets from build (only GIF files are included)

### Code Quality
- **Better error messages** - More descriptive error messages for debugging update issues
- **Improved code organization** - Cleaner separation between public/private repo handling in auto-updater

## 📦 Installation

### Windows
1. Download `Campfire Widget Setup 0.0.4.exe`
2. Run the installer
3. Follow the installation wizard
4. Open "Campfire Widget" from Start Menu

### Mac
1. Download `Campfire Widget-0.0.4.dmg` (Intel) or `Campfire Widget-0.0.4-arm64.dmg` (Apple Silicon)
2. Open the DMG file
3. Drag "Campfire Widget" to Applications
4. Open from Applications folder

## 🔄 Updating from Previous Versions

If you're updating from v0.0.3 or earlier:
- Your settings will be preserved
- No manual migration needed
- Simply install the new version over the old one
- **Note**: After updating, sprites should now load correctly in the desktop app

## 📝 Technical Details

### Changes in This Release
- Updated sprite fetch paths in `dashboard.html` to use absolute URLs (`/sprites/defaults/...`)
- Modified `server.js` to always mount `/sprites` route (removed conditional)
- Updated `package.json` build config to exclude `*.png` files from sprite directory
- Improved auto-updater error handling and duplicate notification prevention
- Added support for both public and private GitHub repositories in auto-updater config

### Sprite Loading Fix
The main issue was that sprites were being fetched with relative paths (`sprites/...`) which didn't work correctly with the Electron app's server structure. Changing to absolute paths (`/sprites/...`) ensures they work in all contexts.

## 🎯 What's Next

Future improvements planned:
- Additional sprite loading optimizations
- Enhanced animation system
- More customization options

## 🐛 Known Issues

- None reported in this release

## 📊 Files Changed

- `desktop-app/server/dashboard.html` - Sprite fetch paths changed to absolute
- `desktop-app/server/server.js` - Always mount `/sprites` route
- `desktop-app/main.js` - Improved auto-updater error handling
- `desktop-app/package.json` - Version bumped to 0.0.4, excluded PNG files
- `server.js` - Synced with desktop version (always mount `/sprites`)
- `dashboard.html` - Synced with desktop version (absolute sprite paths)

---

**Full Changelog**: See commit history for detailed changes
