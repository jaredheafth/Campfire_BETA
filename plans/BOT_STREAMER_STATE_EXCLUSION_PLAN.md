# Bot/Streamer Account Auto-State Exclusion Plan

## Overview

Implement a feature to exclude configured BOT and STREAMER accounts from automatic state transitions (AFK, LURK) while preserving SLEEPY state for visibility purposes.

## ⚠️ CRITICAL PREREQUISITE: Fix State Management Consistency

Before implementing the bot/streamer exclusion feature, we must fix an architectural inconsistency in how state timing values are sourced.

### Current Problem: Two Conflicting Sources

| Component | Source | Values Used |
|-----------|--------|-------------|
| **`UserManager.js`** (Electron main process) | Hardcoded `constants.js` | `SLEEPY_THRESHOLD: 5 min`, `AFK_THRESHOLD: 15 min` |
| **`widget.html`** (Renderer process) | localStorage `userStates` | `sleepyMinutes: 5`, `afkMinutes: 15` (configurable) |

### Why This Is a Problem

1. **Inconsistent behavior** between Electron app and standalone mode
2. **Dashboard sliders don't affect** the Electron app's `UserManager.js`
3. **Single source of truth violated** (violates DEVELOPER_GUIDE principle)

### Fix Plan: Unified State Timing

#### 1.1 Update `UserPreferencesStore.js` to Include State Timing Settings

**File**: `desktop-app/src/main/state/UserPreferencesStore.js`

```javascript
// Add to getSettings()
const DEFAULT_SETTINGS = {
  // ... existing settings
  
  // State timing (defaults match constants.js)
  userStates: {
    enabled: true,
    sleepyMinutes: 5,
    afkMinutes: 15,
    autoLeaveMinutes: 0  // 0 = disabled
  }
};
```

#### 1.2 Modify `UserManager.js` to Use Configurable Settings

**File**: `desktop-app/src/main/state/UserManager.js`

**Change the `_updateUserStates()` method** to use settings instead of constants:

```javascript
// OLD (uses hardcoded constants)
_updateUserStates() {
  const sleepyThreshold = USER_STATE_TIMINGS.SLEEPY_THRESHOLD;
  const afkThreshold = USER_STATE_TIMINGS.AFK_THRESHOLD;
  const autoLeaveThreshold = USER_STATE_TIMINGS.AUTO_LEAVE_THRESHOLD;
}

// NEW (uses configurable settings)
_updateUserStates() {
  const settings = this.preferencesStore?.getSettings() || {};
  const userStates = settings.userStates || {};
  
  const sleepyThreshold = (userStates.sleepyMinutes || 5) * 60 * 1000;
  const afkThreshold = (userStates.afkMinutes || 15) * 60 * 1000;
  const autoLeaveThreshold = (userStates.autoLeaveMinutes || 0) * 60 * 1000;
  
  // Fallback to constants if settings not available
  if (!settings.userStates) {
    console.warn('[UserManager] Using fallback constants for state timings');
  }
}
```

#### 1.3 Add IPC Handler to Broadcast Settings Changes

**File**: `desktop-app/src/main/ipc/UserIPCHandlers.js`

```javascript
// When settings change, broadcast to all windows
ipcMain.on('settings-changed', (event, settings) => {
  // UserManager receives this via IPC bridge and reloads its copy
  if (userManager) {
    userManager.reloadSettings();
  }
});
```

#### 1.4 Ensure Dashboard Saves Settings to Both Locations

**File**: `desktop-app/server/dashboard.html`

```javascript
function saveSettings() {
  // Existing: save to localStorage
  localStorage.setItem('userStates', JSON.stringify(userStates));
  
  // New: also save via IPC for main process
  if (window.electronAPI && window.electronAPI.saveSettings) {
    window.electronAPI.saveSettings({ userStates });
  }
}
```

---

## Background: Bot/Streamer Account Handling

### Current Problem
When the streamer or bot account is joined to the campfire, the automatic state transition logic can incorrectly move them to SLEEPY/AFK states when they haven't typed recently. This is problematic because:
- The streamer is the reason the app is open
- The bot may not "type" in chat but the app is running for its functionality

### User Request
- BOT and STREAMER accounts should be excluded from AUTO STATE transitions by default
- SLEEPY state may still be helpful (visibility indicator)
- AFK/LURK should NOT auto-apply to these accounts
- Either hardcoded or dashboard-configurable (user prefers configurable with sensible defaults)

---

## Implementation: Bot/Streamer Exclusion

### User State Machine
```
IN_CHAT → JOINED → ACTIVE → SLEEPY → AFK → (auto-leave)
                    ↑
                    └── Manual LURK
```

### New Exclusions to Add
- Streamer account (when configured)
- Bot account (when configured)

### Phase 2: Dashboard UI - Auto State Exclusion Settings

#### 2.1 Add Toggle Switches in "Campfire" Tab

**File**: `desktop-app/server/dashboard.html`

**Location**: Inside `#campfireTab`, add after the "Hide Campfire Graphic" section

**New UI Elements**:
```html
<div class="form-group" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #333;">
  <label>
    🔥 Streamer & Bot Account Handling
    <span class="label-hint">Configure how streamer and bot accounts behave at the campfire</span>
  </label>
  
  <div style="margin-top: 15px; padding: 12px; background: #1f1f1f; border-radius: 6px;">
    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-bottom: 12px;">
      <input type="checkbox" id="excludeStreamerFromAutoState" checked onchange="saveExclusionSettings()" style="cursor: pointer; width: 18px; height: 18px;">
      <span>👑 Exclude Streamer from Auto AFK/LURK</span>
    </label>
    
    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-bottom: 12px;">
      <input type="checkbox" id="excludeBotFromAutoState" checked onchange="saveExclusionSettings()" style="cursor: pointer; width: 18px; height: 18px;">
      <span>🤖 Exclude Bot from Auto AFK/LURK</span>
    </label>
    
    <p style="font-size: 11px; color: #888; margin-top: 10px; padding: 10px; background: #252525; border-radius: 4px;">
      💡 <strong>Note:</strong> SLEEPY state will still apply to these accounts (shows inactivity). Only AFK/LURK auto-transitions are blocked. Both accounts will still appear in the campfire scene.
    </p>
  </div>
</div>
```

#### 2.2 Add JavaScript Handlers

**File**: `desktop-app/server/dashboard.html`

```javascript
// Save exclusion settings
function saveExclusionSettings() {
  const settings = {
    excludeStreamerFromAutoState: document.getElementById('excludeStreamerFromAutoState').checked,
    excludeBotFromAutoState: document.getElementById('excludeBotFromAutoState').checked
  };
  
  // Save to localStorage
  localStorage.setItem('streamerBotExclusion', JSON.stringify(settings));
  
  // Broadcast to all windows via custom event
  window.dispatchEvent(new CustomEvent('exclusionSettingsChanged', { detail: settings }));
  
  // Also save via IPC if in Electron
  if (window.electronAPI && window.electronAPI.saveSettings) {
    window.electronAPI.saveSettings(settings);
  }
  
  showStatusMessage('Exclusion settings saved');
}

// Load exclusion settings
function loadExclusionSettings() {
  const saved = localStorage.getItem('streamerBotExclusion');
  if (saved) {
    const settings = JSON.parse(saved);
    document.getElementById('excludeStreamerFromAutoState').checked = settings.excludeStreamerFromAutoState ?? true;
    document.getElementById('excludeBotFromAutoState').checked = settings.excludeBotFromAutoState ?? true;
  }
  // Defaults are already set in HTML (checked="checked")
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  loadExclusionSettings();
});
```

---

### Phase 3: Core Logic Changes

#### 3.1 Update Settings Storage

**File**: `desktop-app/src/main/state/UserPreferencesStore.js`

```javascript
const DEFAULT_EXCLUSION_SETTINGS = {
  excludeStreamerFromAutoState: true,  // Default: enabled
  excludeBotFromAutoState: true,        // Default: enabled
  streamerUserId: null,                 // Set when detected via Twitch
  botUserId: null                      // Set when detected via Twitch
};

// In getSettings() merge with defaults
getSettings() {
  const saved = this._loadSettings() || {};
  return { 
    ...DEFAULT_EXCLUSION_SETTINGS,
    ...saved 
  };
}
```

#### 3.2 Modify `_updateUserStates()` Method

**File**: `desktop-app/src/main/state/UserManager.js`

**Current Code** (lines 513-517):
```javascript
for (const user of this.users.values()) {
  // Skip users who haven't joined or are in manual states
  if (!user.hasJoined) continue;
  if (user.state === USER_STATES.LURK) continue;
  if (user.manualAfk) continue;
```

**New Code**:
```javascript
for (const user of this.users.values()) {
  // Skip users who haven't joined or are in manual states
  if (!user.hasJoined) continue;
  if (user.state === USER_STATES.LURK) continue;
  if (user.manualAfk) continue;
  
  // Skip excluded accounts (streamer/bot) from auto AFK/LURK transitions
  // SLEEPY is still allowed for visibility
  if (this._shouldExcludeFromAutoState(user)) continue;
```

**New Helper Method**:
```javascript
/**
 * Check if user should be excluded from automatic state transitions
 * Excludes streamer and bot accounts from AFK/LURK (but allows SLEEPY)
 * @param {User} user - User to check
 * @returns {boolean} True if user should be skipped from auto state updates
 */
_shouldExcludeFromAutoState(user) {
  const settings = this.preferencesStore?.getSettings() || {};
  
  // Check streamer exclusion (broadcaster role)
  if (settings.excludeStreamerFromAutoState && user.roles.isBroadcaster) {
    return true;
  }
  
  // Check bot exclusion (bot role OR explicit bot user ID)
  if (settings.excludeBotFromAutoState && 
      (user.roles.isBot || user.userId === settings.botUserId)) {
    return true;
  }
  
  // Check explicit user ID exclusions (from dashboard config)
  if (settings.streamerUserId === user.userId || settings.botUserId === user.userId) {
    return true;
  }
  
  return false;
}
```

---

### Phase 4: Detection & Role Assignment

#### 4.1 Streamer/Bot Detection in Twitch IRC

**File**: `desktop-app/main-desktop-v2.js` or `desktop-app/server/server.js`

When connecting to Twitch IRC, the streamer and bot accounts are identified via IRC tags:

```javascript
// In tmi.js message handler
client.on('message', (channel, userstate, message, self) => {
  // Skip messages from ourselves
  if (self) return;
  
  const isBroadcaster = userstate['user-type'] === 'broadcaster' || 
                        userstate.badges?.broadcaster === '1';
  const isBot = userstate.badges?.bot === '1' ||
                userstate.username === CONFIG.CHAT_BOT_USERNAME;
  
  // Add/update user with roles
  const user = userManager.addUser(userstate['user-id'], {
    username: userstate.username,
    displayName: userstate['display-name'],
    roles: {
      isBroadcaster,
      isBot,
      isMod: userstate.mod || userstate.badges?.moderator === '1',
      isVip: userstate.badges?.vip === '1',
      isSubscriber: userstate.subscriber
    },
    twitchColor: userstate.color
  });
  
  // Record activity for this user
  if (user && !isBot) {  // Bots don't trigger activity
    userManager.recordActivity(userstate['user-id']);
  }
});
```

---

### Phase 5: Settings Persistence

#### 5.1 IPC Handlers for Settings

**File**: `desktop-app/src/main/ipc/UserIPCHandlers.js`

```javascript
// Save exclusion settings
ipcMain.handle('save-exclusion-settings', async (event, settings) => {
  const currentSettings = this.preferencesStore.getSettings();
  const newSettings = { ...currentSettings, ...settings };
  await this.preferencesStore.saveSettings(newSettings);
  
  // Broadcast to all windows
  this.mainWindow?.webContents?.send('exclusion-settings-updated', newSettings);
  
  return newSettings;
});

// Get exclusion settings
ipcMain.handle('get-exclusion-settings', async () => {
  return this.preferencesStore.getSettings();
});

// When main window sends settings change from renderer
ipcMain.on('save-exclusion-settings', async (event, settings) => {
  const currentSettings = this.preferencesStore.getSettings();
  const newSettings = { ...currentSettings, ...settings };
  await this.preferencesStore.saveSettings(newSettings);
});
```

---

## Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `desktop-app/src/main/state/UserPreferencesStore.js` | 1 | Add exclusion settings to defaults and storage |
| `desktop-app/src/main/state/UserManager.js` | 1, 3 | Use configurable timings; add `_shouldExcludeFromAutoState()` |
| `desktop-app/src/main/ipc/UserIPCHandlers.js` | 1, 5 | Add IPC handlers for settings |
| `desktop-app/server/dashboard.html` | 2 | Add toggle switches and JavaScript handlers |
| `desktop-app/main-desktop-v2.js` | 4 | Update Twitch client for role detection |
| `desktop-app/server/server.js` | 4 | Update IRC handlers for standalone mode |

---

## User Experience Flow

```mermaid
graph TD
    A[User opens Dashboard] --> B[Goes to Campfire tab]
    B --> C[Sees "Streamer & Bot Account Handling" section]
    C --> D{Toggles Exclusions?}
    D -->|Yes| E[Streamer stays ACTIVE even after 20+ min inactivity]
    D -->|No| F[Normal state transitions apply]
    E --> G[After 5 min inactivity → SLEEPY still applies]
    F --> G
    G --> H[After 20 min total → AFK?]
    H -->|Excluded| E
    H -->|Not excluded| I[Becomes AFK]
```

---

## Testing Checklist

### Phase 1: State Management Consistency
- [ ] Dashboard sliders affect both widget.html and UserManager.js
- [ ] Settings persist after app restart
- [ ] Default values match constants.js

### Phase 2-5: Bot/Streamer Exclusion
- [ ] Streamer joins → stays ACTIVE even after 20 min inactivity
- [ ] Bot joins → stays ACTIVE even after 20 min inactivity
- [ ] Both still transition to SLEEPY after 5 min inactivity
- [ ] Dashboard toggles work and persist settings
- [ ] Normal viewers still transition through all states normally
- [ ] Settings sync between Electron and localStorage

---

## Future Enhancements

1. **Visual Distinction**: Show streamer/bot with special sprite border or indicator
2. **Priority Positioning**: Always show streamer near campfire center
3. **Custom States**: Allow streamer to manually set their own state emoji
4. **Activity Override**: Auto-keep streamer/bot ACTIVE regardless of activity
5. **Dashboard Indicators**: Show which accounts are currently excluded

---

## Summary

This implementation provides:
1. ✅ **Fixed architectural inconsistency** - Single source of truth for state timings
2. ✅ **Configurable exclusion** - Dashboard toggles with sensible defaults (enabled)
3. ✅ **SLEEPY state preserved** - Still shows inactivity for visibility
4. ✅ **Settings persistence** - Survives app restarts
5. ✅ **No impact on normal viewers** - Only affects configured accounts
