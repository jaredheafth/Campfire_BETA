# Campfire Widget - Remaining Tasks Implementation Guide

## Overview
This guide provides detailed implementation instructions for the remaining medium and high complexity tasks in the Campfire Widget project.

---

## MEDIUM COMPLEXITY TASKS

### Task 4: Members Tab Refresh Button
**Status:** Pending  
**Complexity:** LOW-MEDIUM  
**Files:** `desktop-app/server/dashboard.html`, `desktop-app/main.js`

**Problem:** The Refresh button in the Members tab may not be properly refreshing the chatters list and updating statuses.

**Investigation Steps:**
1. Find `refreshMembersList()` function in dashboard.html
2. Check if it calls `loadDashboardMembers()` correctly
3. Verify IPC communication with main.js for fetching current chatters

**Implementation:**
```javascript
// In dashboard.html - refreshMembersList() should:
// 1. Call electronAPI to get current chatters from Twitch
// 2. Update the members list UI
// 3. Sync with widget's current user list
```

**Key Functions to Check:**
- `refreshMembersList()` in dashboard.html
- `loadDashboardMembers()` in dashboard.html
- IPC handler `get-chatters` in main.js

---

### Task 5: Members Tab Duplicate Usernames
**Status:** Pending  
**Complexity:** MEDIUM  
**Files:** `desktop-app/server/dashboard.html`, `desktop-app/server/widget.html`, `desktop-app/main.js`

**Problem:** Duplicate usernames appearing in the Members list, possibly due to persistence/rejoining logic issues.

**Investigation Steps:**
1. Search for deduplication logic in dashboard.html and widget.html
2. Check how users are stored and retrieved
3. Verify the join/leave event handling

**Implementation:**
```javascript
// Ensure user list uses Map or Set with username as key
// Before adding user, check if already exists:
if (!this.users.find(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
    this.users.push(newUser);
}
```

**Key Areas:**
- User storage in widget.html (`this.users` array)
- `addUser()` and `removeUser()` methods
- Dashboard members list rendering

---

### Task 6: Twitch Emotes in Chat Bubbles
**Status:** Pending  
**Complexity:** MEDIUM  
**Files:** `desktop-app/server/widget.html`, `desktop-app/main.js`

**Problem:** Twitch emotes (especially animated ones) not displaying properly in chat bubbles, size may be incorrect.

**Investigation Steps:**
1. Find `showChatMessage()` or similar function in widget.html
2. Check how emotes are parsed from Twitch messages
3. Verify emote URL construction (static vs animated)

**Implementation:**
```javascript
// Parse Twitch emotes from message tags
// For each emote:
// 1. Get emote ID from tags.emotes
// 2. Construct URL: https://static-cdn.jtvnw.net/emoticons/v2/{id}/default/dark/1.0
// 3. For animated: https://static-cdn.jtvnw.net/emoticons/v2/{id}/animated/dark/1.0
// 4. Replace text with <img> tag
// 5. Apply consistent sizing (e.g., 24px height)
```

**Key Functions:**
- `showChatMessage()` in widget.html
- Emote parsing in main.js Twitch chat handler
- CSS for `.chat-message img` sizing

---

## HIGH COMPLEXITY TASKS

### Task 2: Unique Sprites Per User Role
**Status:** Deferred  
**Complexity:** HIGH  
**Files:** `desktop-app/server/dashboard.html`, `desktop-app/server/widget.html`, `desktop-app/main.js`

**Problem:** Need ability to assign different sprites based on user roles (Broadcaster, Mod, VIP, Sub, Follower, Regular).

**Implementation Plan:**

1. **Dashboard UI (Sprite Tab):**
   - Add toggle: "Enable Role-Based Sprites"
   - Add role checkboxes with sprite selectors for each:
     - Broadcaster
     - Moderator
     - VIP
     - Subscriber (Tier 1/2/3)
     - Follower
     - Regular Viewer

2. **Settings Structure:**
```javascript
{
    enableRoleBasedSprites: true,
    roleSprites: {
        broadcaster: { enabled: true, spriteData: '...' },
        moderator: { enabled: true, spriteData: '...' },
        vip: { enabled: true, spriteData: '...' },
        subscriber: { enabled: true, spriteData: '...' },
        follower: { enabled: true, spriteData: '...' },
        regular: { enabled: false, spriteData: null }
    }
}
```

3. **Widget Logic:**
```javascript
// In getSprite() or similar:
getUserSprite(user) {
    if (!this.settings.enableRoleBasedSprites) {
        return this.getDefaultSprite();
    }
    
    // Check roles in priority order
    if (user.isBroadcaster && this.settings.roleSprites.broadcaster.enabled) {
        return this.settings.roleSprites.broadcaster.spriteData;
    }
    if (user.isMod && this.settings.roleSprites.moderator.enabled) {
        return this.settings.roleSprites.moderator.spriteData;
    }
    // ... continue for other roles
    
    return this.getDefaultSprite();
}
```

4. **User Role Detection:**
   - Twitch tags provide: `badges`, `mod`, `subscriber`, `vip`
   - Need to pass these to widget when user joins

---

### Task 3: Audio System
**Status:** Deferred  
**Complexity:** HIGH  
**Files:** `desktop-app/server/dashboard.html`, `desktop-app/server/widget.html`, `desktop-app/main.js`

**Problem:** Audio buttons/sliders not connected, missing device selection, User SFX triggers not implemented.

**Implementation Plan:**

1. **Missing Functions to Create:**
```javascript
// In dashboard.html:
function previewAudio(audioType) {
    // Play preview of selected audio file
    const audio = new Audio(getAudioPath(audioType));
    audio.volume = getVolumeForType(audioType);
    audio.play();
}

function updateAudioSetting(settingName, value) {
    // Update audio setting and save
    // Sync with widget
}
```

2. **Audio Device Selection:**
```javascript
// Get available audio devices
navigator.mediaDevices.enumerateDevices()
    .then(devices => {
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        // Populate dropdown
    });

// Set output device (requires setSinkId)
audioElement.setSinkId(deviceId);
```

3. **User SFX Triggers:**
   - Join sound: Play when user joins campfire
   - Leave sound: Play when user leaves
   - Chat sound: Play when user sends message
   - Command sounds: Play for specific commands

4. **Settings Structure:**
```javascript
{
    audio: {
        enabled: true,
        outputDevice: 'default',
        masterVolume: 0.8,
        sounds: {
            join: { enabled: true, file: 'join.mp3', volume: 0.5 },
            leave: { enabled: true, file: 'leave.mp3', volume: 0.5 },
            chat: { enabled: false, file: null, volume: 0.3 },
            command: { enabled: true, file: 'command.mp3', volume: 0.5 }
        }
    }
}
```

---

### Task 8: User States System
**Status:** Future Feature  
**Complexity:** HIGH  
**Files:** `desktop-app/server/widget.html`, `desktop-app/server/dashboard.html`

**Problem:** Need visual states for users: ACTIVE, JOINED, SLEEPY, AFK with outer circle indicator.

**Implementation Plan:**

1. **State Definitions:**
   - ACTIVE: User recently chatted (within X minutes)
   - JOINED: User just joined (first X seconds)
   - SLEEPY: User hasn't chatted in Y minutes
   - AFK: User hasn't chatted in Z minutes

2. **Visual Indicators:**
```css
.user-state-active .state-ring { border-color: #00ff00; }
.user-state-joined .state-ring { border-color: #ffff00; animation: pulse; }
.user-state-sleepy .state-ring { border-color: #888888; opacity: 0.7; }
.user-state-afk .state-ring { border-color: #444444; opacity: 0.5; }
```

3. **State Tracking:**
```javascript
// Track last activity time for each user
user.lastActivity = Date.now();

// Update state periodically
updateUserStates() {
    const now = Date.now();
    this.users.forEach(user => {
        const idleTime = now - user.lastActivity;
        if (idleTime < 30000) user.state = 'active';
        else if (idleTime < 300000) user.state = 'sleepy';
        else user.state = 'afk';
    });
}
```

4. **Dashboard Settings:**
   - Enable/disable state indicators
   - Configure time thresholds
   - Customize colors for each state

---

## File Reference

| File | Purpose |
|------|---------|
| `desktop-app/server/dashboard.html` | Main dashboard UI, settings forms, JavaScript functions |
| `desktop-app/server/widget.html` | Widget display, user rendering, animations |
| `desktop-app/main.js` | Electron main process, IPC handlers, Twitch integration |
| `desktop-app/preload.js` | IPC bridge between renderer and main process |

## Testing Checklist

- [ ] Test each feature in isolation
- [ ] Verify settings save/load correctly
- [ ] Check IPC communication between dashboard and widget
- [ ] Test with actual Twitch connection
- [ ] Verify no console errors
- [ ] Test edge cases (no users, many users, rapid joins/leaves)

---

## Copy-Paste Prompt for New Session

```
I need to implement the following features for the Campfire Widget Electron app:

## Task: [TASK NAME]

### Context:
- This is an Electron desktop app with a dashboard (settings) and widget (display) window
- Main files: desktop-app/server/dashboard.html, desktop-app/server/widget.html, desktop-app/main.js
- Settings are saved via IPC and synced between windows

### Requirements:
[Copy specific task requirements from above]

### Implementation Notes:
[Copy implementation plan from above]

Please:
1. First analyze the existing code structure
2. Identify all files that need modification
3. Implement the feature step by step
4. Test the changes work correctly
5. Ensure settings save/load properly
```
