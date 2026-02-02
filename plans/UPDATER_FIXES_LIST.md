# UPDATER Fixes List with Risk Assessment

**Created:** 2026-02-02  
**Status:** Ready for Implementation

---

## Critical Priority Fixes (Must Do First)

### Fix 1: Refactor shutdownEntireApp() with Proper Async Sequencing

**Issue:** Windows not properly closed before quitAndInstall(), 600ms timeout insufficient

**Risk Level:** HIGH - Modifies core shutdown logic

**Impact:** 
- If broken: App may hang on shutdown or update
- If fixed: Clean shutdown before updates

**Changes:**
- Replace 600ms timeout with Promise.all() for window closure
- Add window closure verification
- Increase timeout to 5 seconds with fallback to force close

**Code Changes:**
```javascript
// Replace simple timeout with Promise-based window closure
const windows = BrowserWindow.getAllWindows();
const closePromises = windows.map(w => {
    return new Promise(resolve => {
        if (w.isDestroyed()) { resolve(); return; }
        w.once('closed', resolve);
        w.removeAllListeners('close');
        w.close();
    });
});
await Promise.race([
    Promise.all(closePromises),
    new Promise(resolve => setTimeout(resolve, 5000))
]);
```

**Affected Files:** `desktop-app/main.js`

---

### Fix 2: Fix disconnectTwitchClients() to Properly Await

**Issue:** Twitch disconnection is async but not properly awaited

**Risk Level:** MEDIUM - Modifies Twitch client logic

**Impact:**
- If broken: Twitch connection may hang
- If fixed: Clean network shutdown

**Changes:**
- Remove nested try-catch blocks
- Properly await all disconnections
- Add timeout for disconnection

**Code Changes:**
```javascript
async function disconnectTwitchClients() {
    const disconnectPromises = [];
    
    if (twitchClient) {
        disconnectPromises.push(
            Promise.race([
                twitchClient.disconnect().catch(() => {}),
                new Promise(resolve => setTimeout(resolve, 3000))
            ])
        );
    }
    
    if (twitchChatClient) {
        disconnectPromises.push(
            Promise.race([
                twitchChatClient.disconnect().catch(() => {}),
                new Promise(resolve => setTimeout(resolve, 3000))
            ])
        );
    }
    
    await Promise.all(disconnectPromises);
    twitchClient = null;
    twitchChatClient = null;
    isTwitchConnected = false;
    isTwitchChatConnected = false;
}
```

**Affected Files:** `desktop-app/main.js`

---

### Fix 3: Add Window Closure Verification

**Issue:** No verification that windows are actually closed before quitAndInstall()

**Risk Level:** LOW - Adds validation, doesn't change logic

**Impact:**
- If broken: No impact
- If fixed: Better error detection

**Changes:**
- Add check after window closure loop
- Force close any remaining windows
- Log warning if windows remain

**Code Changes:**
```javascript
// After window closure loop
const remainingWindows = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
if (remainingWindows.length > 0) {
    console.warn(`[Main] ${remainingWindows.length} windows still open, forcing close`);
    remainingWindows.forEach(w => w.destroy());
}
```

**Affected Files:** `desktop-app/main.js`

---

## High Priority Fixes

### Fix 4: Fix Repo Name Mismatch

**Issue:** package.json uses `Campfire_BETA` but code uses `offlineclub_widget_Campfire`

**Risk Level:** LOW - Configuration fix only

**Impact:**
- If broken: Update checks may fail
- If fixed: Update checks work correctly

**Changes:**
- Update package.json repo name OR main.js repo name to match

**Files to Check:**
- `desktop-app/package.json` line 78
- `desktop-app/main.js` line 6826

---

### Fix 5: Fix IPC Handlers to Return Error Objects

**Issue:** IPC handlers return undefined on error instead of error objects

**Risk Level:** MEDIUM - Changes return values

**Impact:**
- If broken: UI may receive undefined
- If fixed: UI can properly handle errors

**Changes:**
- Add try-catch with return { success: false, error: ... }
- Return consistent response format

**Code Changes:**
```javascript
ipcMain.handle('check-for-updates', async () => {
    try {
        autoUpdater.setFeedURL(feedConfig);
        const result = await autoUpdater.checkForUpdates();
        return { 
            success: true, 
            updateInfo: result?.updateInfo 
        };
    } catch (err) {
        console.error('[Updater] checkForUpdates failed:', err);
        return { 
            success: false, 
            error: err.message 
        };
    }
});
```

**Affected Files:** `desktop-app/main.js`

---

## Medium Priority Fixes

### Fix 6: Remove Double quitAndInstall() Fallback

**Issue:** Both shutdownEntireApp() and catch block call quitAndInstall()

**Risk Level:** MEDIUM - Changes shutdown flow

**Impact:**
- If broken: Duplicate quitAndInstall calls
- If fixed: Single, clean shutdown path

**Changes:**
- Remove quitAndInstall() from catch block
- Only call in shutdownEntireApp()

**Code Changes:**
```javascript
// In install-update handler:
shutdownEntireApp({ reason: 'install-update', forUpdate: true });

// REMOVE the catch block that calls quitAndInstall()
```

**Affected Files:** `desktop-app/main.js`

---

### Fix 7: Add Network Error Handling

**Issue:** No retry or user notification on network errors

**Risk Level:** LOW - Adds error handling

**Impact:**
- If broken: Silent failures
- If fixed: User gets feedback

**Changes:**
- Add retry with exponential backoff
- Log network errors with details
- Consider adding user notification

**Code Changes:**
```javascript
async function checkForUpdatesWithRetry(maxRetries = 3) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await autoUpdater.checkForUpdates();
        } catch (err) {
            lastError = err;
            const delay = Math.pow(2, i) * 1000;
            console.warn(`[Updater] Retry ${i + 1}/${maxRetries} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
```

**Affected Files:** `desktop-app/main.js`

---

## Low Priority Fixes

### Fix 8: Make Signature Verification Configurable

**Issue:** Signature verification hardcoded to false on Windows

**Risk Level:** MEDIUM - Security-related change

**Impact:**
- If broken: Security risk in production
- If fixed: Configurable based on build type

**Changes:**
- Only disable signature verification in development
- Use app.isPackaged to determine

**Code Changes:**
```javascript
// Only disable in development
if (process.platform === 'win32' && !app.isPackaged) {
    autoUpdater.verifySignature = false;
}
```

**Affected Files:** `desktop-app/main.js`

---

### Fix 9: Enable Background Updates on Windows

**Issue:** Background update checks disabled on Windows

**Risk Level:** LOW - Feature enhancement

**Impact:**
- If broken: No background updates on Windows
- If fixed: Background updates work on Windows

**Changes:**
- Remove platform check for background updates
- Or add setting for user to enable/disable

**Code Changes:**
```javascript
// Current (Windows disabled):
const shouldBackgroundCheckUpdates = app.isPackaged && process.platform !== 'win32';

// Proposed (all platforms):
const shouldBackgroundCheckUpdates = app.isPackaged;
```

**Affected Files:** `desktop-app/main.js`

---

### Fix 10: Add State Saving Before Shutdown

**Issue:** No state saving before shutdown/update

**Risk Level:** MEDIUM - Adds state management

**Impact:**
- If broken: Unsaved state lost
- If fixed: State preserved across updates

**Changes:**
- Add prepare-shutdown event to renderer
- Save all state before closing windows

**Code Changes:**
```javascript
// In shutdownEntireApp():
// Notify all windows to prepare for shutdown
widgetWindow?.webContents?.send('prepare-shutdown');

// Wait for state to be saved
await new Promise(resolve => setTimeout(resolve, 500));
```

**Affected Files:** `desktop-app/main.js`, `desktop-app/server/widget.html`

---

## Implementation Order

| Order | Fix | Risk | Estimated Time |
|-------|-----|------|----------------|
| 1 | Fix 5: IPC Error Objects | Medium | 5 min |
| 2 | Fix 7: Network Error Handling | Low | 10 min |
| 3 | Fix 4: Repo Name Match | Low | 2 min |
| 4 | Fix 3: Window Verification | Low | 5 min |
| 5 | Fix 6: Remove Double Fallback | Medium | 5 min |
| 6 | Fix 2: Twitch Disconnect | Medium | 10 min |
| 7 | Fix 1: Shutdown Sequence | High | 15 min |
| 8 | Fix 10: State Saving | Medium | 10 min |
| 9 | Fix 8: Signature Config | Medium | 5 min |
| 10 | Fix 9: Windows Background | Low | 5 min |

**Total Estimated Time:** ~72 minutes

---

## Files to Modify

1. `desktop-app/main.js` - All fixes
2. `desktop-app/package.json` - Fix 4
3. `desktop-app/server/widget.html` - Fix 10
