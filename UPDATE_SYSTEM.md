# 🔄 Update System - Installer & Auto-Updater

## Installer Updates (Manual)

### ✅ Yes - Installer Updates Existing Versions

When you download and install a new version:

**Windows:**
- ✅ NSIS installer **automatically replaces** the old version
- ✅ Preserves user data (settings, sprites, etc.)
- ✅ Same `appId` and GUID ensures Windows recognizes it as the same app
- ✅ Shortcuts are updated automatically
- ✅ User can choose to keep or change installation directory

**Mac:**
- ✅ DMG installer **replaces** the old app in Applications
- ✅ User data is preserved (in `~/Library/Application Support/Campfire Widget`)
- ✅ Just drag new app to Applications (replaces old one)

### Configuration for Updates

The installer is configured with:
- **Stable GUID**: `a8f8e5c3-7b4d-4e9f-9a2b-1c3d4e5f6a7b` (same across versions)
- **Stable appId**: `com.campfirewidget.app` (same across versions)
- **Preserves user data**: Settings and sprites are not deleted

---

## Auto-Updater (Built-In)

### ✅ Auto-Update Feature Added

The dashboard now has an auto-update system that:

1. **Checks for updates**:
   - Automatically checks on app startup (after 5 seconds)
   - Checks every 4 hours while app is running
   - Manual "Check for Updates" button in dashboard

2. **Downloads updates**:
   - When update is available, shows notification
   - User clicks "Download Update" button
   - Shows download progress (percentage, MB downloaded)
   - Downloads in background

3. **Installs updates**:
   - After download, shows "Install & Restart" button
   - User clicks to install
   - App closes, updates, and restarts automatically

### How It Works

- **Uses `electron-updater`** library
- **GitHub Releases** as update source
- **Metadata files** (`latest.yml`, etc.) are generated automatically
- **Version checking** compares current version with GitHub Releases

### User Experience

1. **App starts** → Checks for updates silently
2. **Update available** → Shows notification in dashboard header
3. **User clicks "Download Update"** → Downloads in background
4. **Download complete** → Shows "Install & Restart" button
5. **User clicks "Install & Restart"** → App closes, updates, restarts

### Update Status Display

The dashboard shows update status in the header:
- **Checking...** - Checking for updates
- **Update available: vX.X.X** - New version found
- **You have the latest version** - No updates
- **Update downloaded** - Ready to install
- **Download progress** - Shows percentage and MB

### Manual Check

Users can manually check for updates:
- Click "Check for Updates" button in dashboard header
- Or use the "🔄 Check for Updates" button in info box

---

## GitHub Releases Integration

### Publishing Updates

When you publish a new version:

1. **Build installers**:
   ```bash
   cd desktop-app
   npm run build:all
   ```

2. **Create GitHub Release**:
   - Upload new installers (`.exe` and `.dmg`)
   - electron-builder generates `latest.yml` automatically
   - Tag the release (e.g., `v0.0.1`)

3. **Users get notified**:
   - App checks GitHub Releases
   - If version is newer, shows update notification
   - User can download and install

### Update Metadata

electron-builder automatically creates:
- `latest.yml` - Update metadata (Windows)
- `latest-mac.yml` - Update metadata (Mac)
- `.blockmap` files - For differential updates (future)

---

## Installation Behavior

### First Install
- Fresh installation
- Creates app in Applications/Program Files
- Sets up shortcuts
- Creates user data directory

### Update Install
- **Windows**: Replaces old files, preserves user data
- **Mac**: Replaces app bundle, preserves user data
- **Both**: Keeps all settings, sprites, configurations
- **Both**: Shortcuts remain unchanged

### Uninstall
- **Windows**: Use Settings → Apps → Uninstall
- **Mac**: Drag to Trash
- **User data**: May remain (can be manually deleted if desired)

---

## Requirements

### For Auto-Updater to Work

1. **GitHub Releases**: Updates must be published to GitHub Releases
2. **Version numbering**: Use semantic versioning (e.g., 0.0.1, 0.0.2, 1.0.0)
3. **Metadata files**: `latest.yml` must be present (auto-generated)
4. **Internet connection**: Required to check for updates

### Dependencies

- `electron-updater@^6.1.7` - Auto-update library
- GitHub Releases with installers uploaded
- Proper version increment in `package.json`

---

## Testing

### Test Update Flow

1. **Install v0.0.0** from GitHub Releases
2. **Create v0.0.1** release on GitHub
3. **Open app** → Should check for updates
4. **See update notification** → Click "Download Update"
5. **Wait for download** → Click "Install & Restart"
6. **App restarts** → Verify version is 0.0.1

### Manual Installer Test

1. **Install v0.0.0**
2. **Download v0.0.1 installer**
3. **Run installer** → Should update existing installation
4. **Open app** → Should show v0.0.1

---

## Summary

### ✅ Installer Updates
- **Works**: NSIS installer replaces old version correctly
- **Preserves**: User data and settings
- **Safe**: Same GUID ensures proper upgrade

### ✅ Auto-Updater
- **Added**: Built-in update checker in dashboard
- **Source**: GitHub Releases
- **Flow**: Check → Download → Install
- **User-friendly**: Progress bars, notifications, manual controls

Both update methods work! Users can either:
- **Auto-update**: Use the built-in updater (recommended)
- **Manual update**: Download new installer from GitHub Releases
