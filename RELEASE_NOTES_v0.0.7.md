# Release Notes - v0.0.7

## 🐛 Critical Fixes

### Auto-Update Signature Verification
- **Fixed unsigned installer updates** - Added `verifySignature: false` to allow auto-updates to work with unsigned installers
- **Windows compatibility** - Auto-updates will now proceed even without code signing certificates
- **User experience** - Users can now update directly from the dashboard without manual downloads

### Filename Consistency
- **Standardized naming** - All installers now use hyphens consistently:
  - Windows: `Campfire-Widget-Setup-0.0.7.exe`
  - Mac Intel: `Campfire-Widget-0.0.7-x64.dmg`
  - Mac ARM64: `Campfire-Widget-0.0.7-arm64.dmg`
- **Metadata matching** - Metadata files automatically match installer filenames
- **No more filename mismatches** - Eliminates 404 errors from metadata/installer name mismatches

## ✨ Improvements

### Build Configuration
- **Package name updated** - Changed to `Campfire-Widget` for consistent hyphenated naming
- **Artifact naming** - Uses `${name}` instead of `${productName}` to ensure hyphens throughout
- **Future-proof** - All future releases will automatically use hyphenated filenames

## 📋 Technical Details

### Changes in This Release
- Added `autoUpdater.verifySignature = false` in `main.js` to skip signature verification
- Updated `package.json` name from `campfire-widget-desktop` to `Campfire-Widget`
- Changed artifact name templates to use `${name}` instead of `${productName}`
- All installers now built with consistent hyphenated filenames

### Files Changed
- `desktop-app/main.js` - Added signature verification bypass
- `desktop-app/package.json` - Updated package name and artifact naming

## 🚀 Installation & Update

### For New Users
1. Download the installer for your platform:
   - **Windows**: `Campfire-Widget-Setup-0.0.7.exe`
   - **Mac Intel**: `Campfire-Widget-0.0.7-x64.dmg`
   - **Mac Apple Silicon**: `Campfire-Widget-0.0.7-arm64.dmg`
2. Run the installer and follow the setup wizard
3. Launch the app

### For Existing Users (v0.0.5 and earlier)
1. Open the dashboard
2. Click **"🔄 Check for Updates"** button
3. When prompted, download and install v0.0.7
4. The app will automatically restart with the new version
5. **Note**: Windows may show a security warning for unsigned installers - click "More info" → "Run anyway"

### Important Notes
- **Windows Security Warning**: Since installers are not code-signed, Windows Defender may show a warning. This is expected and safe - click "More info" → "Run anyway" to proceed.
- **Auto-updates work**: Starting with v0.0.7, auto-updates will work even without code signing (with Windows warnings).
- **Future releases**: All future releases will use hyphenated filenames automatically.

## 🔍 What's Fixed from v0.0.6

This release addresses the signature verification issue that prevented v0.0.6 from auto-updating. Users on v0.0.5 or earlier can now update directly to v0.0.7 without needing to manually install v0.0.6 first.

## 📦 What's Included

- ✅ Windows installer (x64) - `Campfire-Widget-Setup-0.0.7.exe`
- ✅ Mac installer (Intel x64) - `Campfire-Widget-0.0.7-x64.dmg`
- ✅ Mac installer (Apple Silicon ARM64) - `Campfire-Widget-0.0.7-arm64.dmg`
- ✅ Auto-update metadata files (`latest.yml`, `latest-mac.yml`)

## 🎯 What's Next

Future improvements planned:
- Code signing for production releases (eliminates Windows warnings)
- Continued sprite path resolution improvements
- Additional UI/UX enhancements

---

**Version**: 0.0.7  
**Release Date**: January 16, 2026  
**Compatibility**: Windows 10+, macOS 10.12+
