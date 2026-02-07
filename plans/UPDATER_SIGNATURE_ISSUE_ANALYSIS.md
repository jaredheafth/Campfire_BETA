# UPDATER Signature Issue Analysis & Fix Plan

**Analyzed:** 2026-02-04  
**Status:** Ready for Implementation

---

## Problem Statement

The UPDATER acknowledges a newer version is available but fails to complete the update process due to a **signature verification error**. This happens during the download or install phase.

---

## Root Cause Analysis

### The Issue: Signature Verification Not Properly Disabled

Looking at [`desktop-app/main.js`](desktop-app/main.js:7111), the code attempts to disable signature verification:

```javascript
// Lines 7111-7124
try {
    // New API for v6.x
    if (typeof autoUpdater.disableWin32CertCheck !== 'undefined') {
        autoUpdater.disableWin32CertCheck = true;
    }
    // Legacy API for older versions
    if (process.platform === 'win32' && typeof autoUpdater.verifySignature !== 'undefined') {
        autoUpdater.verifySignature = false;
    }
} catch (e) {
    console.warn('[Updater] Could not configure signature verification:', e.message);
}
```

**The Problem:**

1. **`setFeedURL()` resets configuration**: When [`checkForUpdatesWithRetry()`](desktop-app/main.js:6961) calls `autoUpdater.setFeedURL(feedConfig)` at line 6976, it may reset the signature verification settings back to their defaults.

2. **Platform-limited fix**: The `verifySignature = false` only applies on Windows (`process.platform === 'win32'`). On macOS/Linux, signature verification remains enabled.

3. **electron-updater v6.x API changes**: The `disableWin32CertCheck` property might not work as expected in v6.x, or the `typeof` check might be returning `false` even when the property exists.

4. **No verification after setFeedURL**: After calling `setFeedURL()`, the code doesn't re-apply the signature verification disable.

---

## Files Affected

| File | Lines | Issue |
|------|-------|-------|
| `desktop-app/main.js` | 7111-7124 | Signature verification not properly disabled |
| `desktop-app/main.js` | 6976 | `setFeedURL()` resets configuration |
| `desktop-app/main.js` | 7013-7020 | `download-update` handler lacks signature error handling |

---

## Solution

### Fix 1: Re-apply Signature Verification Settings After setFeedURL()

**Location:** [`checkForUpdatesWithRetry()`](desktop-app/main.js:6961)

After `autoUpdater.setFeedURL(feedConfig)`, re-apply the signature verification disable:

```javascript
// Re-apply signature verification disable after setting feed URL
// This is necessary because setFeedURL() may reset these settings
try {
    if (typeof autoUpdater.disableWin32CertCheck !== 'undefined') {
        autoUpdater.disableWin32CertCheck = true;
    }
    if (typeof autoUpdater.verifySignature !== 'undefined') {
        autoUpdater.verifySignature = false;
    }
} catch (e) {
    console.warn('[Updater] Could not configure signature verification after setFeedURL:', e.message);
}
```

### Fix 2: Enable Signature Verification Disable on All Platforms

**Location:** [`initializeAutoUpdater()`](desktop-app/main.js:7111)

Remove the Windows-only condition for `verifySignature`:

```javascript
// BEFORE (Windows only):
if (process.platform === 'win32' && typeof autoUpdater.verifySignature !== 'undefined') {
    autoUpdater.verifySignature = false;
}

// AFTER (all platforms):
if (typeof autoUpdater.verifySignature !== 'undefined') {
    autoUpdater.verifySignature = false;
}
```

### Fix 3: Add Signature Error Detection and Handling

**Location:** [`download-update`](desktop-app/main.js:7013) handler

Detect signature-related errors and return a more helpful error message:

```javascript
ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        console.error('Error downloading update:', error);
        
        // Check for signature-related errors
        const isSignatureError = error.message?.includes('signature') ||
                                 error.message?.includes('SIGKILL') ||
                                 error.message?.includes('verification') ||
                                 error.message?.includes('cert') ||
                                 error.message?.includes('Unable to verify signature');
        
        if (isSignatureError) {
            return { 
                success: false, 
                error: 'Signature verification failed. The update may not be properly signed.',
                code: 'SIGNATURE_ERROR'
            };
        }
        
        return { success: false, error: error.message };
    }
});
```

### Fix 4: Add Better Logging for Debugging

Add explicit logging to help diagnose signature issues:

```javascript
// After setting feed URL, log the configuration
console.log('[Updater] Feed URL set:', feedConfig.provider, feedConfig.owner, feedConfig.repo);

// After signature verification disable, log the state
console.log('[Updater] Signature verification:', 
    typeof autoUpdater.verifySignature !== 'undefined' ? 
        (autoUpdater.verifySignature ? 'enabled' : 'disabled') : 'not supported');
```

---

## Implementation Steps

| Step | Description | File | Lines |
|------|-------------|------|-------|
| 1 | Add signature verification re-application after `setFeedURL()` | `desktop-app/main.js` | After line 6976 |
| 2 | Remove Windows-only condition from `verifySignature` | `desktop-app/main.js` | Line 7119 |
| 3 | Add signature error detection in `download-update` handler | `desktop-app/main.js` | 7013-7020 |
| 4 | Add debug logging for updater configuration | `desktop-app/main.js` | Multiple locations |

---

## Testing Checklist

After implementing the fixes:

- [ ] Click "Check for Updates" → Should show update available dialog
- [ ] Click "Download" → Download should complete without signature errors
- [ ] Click "Install" → App should restart and install successfully
- [ ] Check logs for signature verification status
- [ ] Test on Windows, macOS, and Linux if possible

---

## Related Issues (from existing plans)

This fix addresses the signature issue mentioned in:
- [`plans/UPDATER_FIXES_LIST.md`](plans/UPDATER_FIXES_LIST.md) - Fix 8: Make Signature Verification Configurable
- [`plans/UPDATER_AND_UNINSTALLER_ANALYSIS.md`](plans/UPDATER_AND_UNINSTALLER_ANALYSIS.md) - Part 1: UPDATER SYSTEM ANALYSIS
