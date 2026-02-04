# Campfire Widget v0.1.6 Release Notes

## Bug Fixes

### Updater Signature Verification Fix
- Fixed "this.verifySignature is not a function" error that occurred when attempting to download updates
- The `electron-updater` v6.x API changed how signature verification is handled
- Wrapped signature verification configuration in try-catch to prevent errors
- Uses correct v6.x API (`disableWin32CertCheck`) when available
- Falls back to legacy API if it exists

### Updater Quit and Install Fix
- Fixed "Cannot download update automatically because the application is still running" error
- Added fallback `app.quit()` call 1 second after `quitAndInstall()` to ensure the app exits properly
- Increased window destruction delay from 300ms to 500ms for more reliable cleanup
- Ensures the NSIS installer can replace files without conflicts

## Changes Made

### Files Modified
- `desktop-app/main.js` - Updater configuration and install logic
- `desktop-app/main-desktop-v2.js` - Same fixes for consistency
- `desktop-app/server/main.js` - Same fixes for server process

### Technical Details
The updater was failing because:
1. `electron-updater` v6.x doesn't have `verifySignature` as a direct property
2. The app wasn't exiting quickly enough for the NSIS installer to run

Both issues are now resolved with defensive coding and fallback mechanisms.
