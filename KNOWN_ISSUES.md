# Known Issues & Future Improvements

This document tracks known issues discovered during development that need to be addressed in future tasks. Each issue includes the error message, root cause analysis, affected files, and suggested fix approach.

**Last Updated:** 2026-01-26

---

## Table of Contents
1. [High Priority](#high-priority)
2. [Medium Priority](#medium-priority)
3. [Low Priority](#low-priority)

---

## High Priority

*No high priority issues at this time.*

---

## Medium Priority

### 1. Twitch API Client Not Initialized During Join Simulation

**Error Message:**
```
[simulate-join-command] Could not fetch Twitch data for heafth: Cannot read properties of undefined (reading 'getUserByName')
```

**Root Cause:**
The `twitchClient.api.users.getUserByName()` call fails because `twitchClient.api` is undefined when the join simulation runs. The Twitch API client may not be fully initialized at the time the streamer/bot auto-join is triggered.

**Affected Files:**
- [`desktop-app/main.js`](desktop-app/main.js) - `simulate-join-command` IPC handler (~line 4726)
- [`desktop-app/server/widget.html`](desktop-app/server/widget.html) - `simulateJoinForConnectedUsers()` method

**Suggested Fix:**
1. Add a check for `twitchClient.api` existence before calling API methods
2. Consider deferring the join simulation until the API is confirmed ready
3. Add a retry mechanism with exponential backoff

**Code Location to Start:**
```javascript
// desktop-app/main.js ~line 4726
ipcMain.handle('simulate-join-command', async (event, username, userId) => {
    // Add check here:
    if (!twitchClient || !twitchClient.api) {
        console.log(`[simulate-join-command] Twitch API not ready, deferring join for ${username}`);
        return { success: false, error: 'Twitch API not ready' };
    }
    // ... rest of handler
});
```

---

### 2. Sprite URL Being Set to [object Object]

**Error Message:**
```
[createUserElement] Failed to load sprite for heafth
[object%20Object]:1 Failed to load resource: net::ERR_FILE_NOT_FOUND
```

**Root Cause:**
The sprite URL is being set to `[object Object]` instead of a valid path string. This indicates an object is being passed where a string URL is expected, likely in the sprite loading logic.

**Affected Files:**
- [`desktop-app/server/widget.html`](desktop-app/server/widget.html) - `createUserElement()` method (~line 3902)
- [`desktop-app/server/widget.html`](desktop-app/server/widget.html) - `getUserSprite()` method (~line 1802)

**Suggested Fix:**
1. Add type checking in `getUserSprite()` to ensure it returns a string
2. Add defensive checks in `createUserElement()` before setting `src` attribute
3. Log the actual value being passed to identify the source of the object

**Code Location to Start:**
```javascript
// In getUserSprite() - add return type validation
getUserSprite(username, userId) {
    // ... existing logic ...
    const result = /* sprite path logic */;
    
    // Add validation
    if (typeof result !== 'string') {
        console.error('[getUserSprite] Invalid sprite path:', result);
        return this.getDefaultSprite(); // fallback
    }
    return result;
}
```

---

## Low Priority

### 3. GPU Process Crashes on Windows

**Error Message:**
```
[ERROR:gpu_process_host.cc(991)] GPU process exited unexpectedly: exit_code=-1073740791
```

**Root Cause:**
This is a known Electron/Chromium issue on Windows, particularly with certain GPU drivers. The error code `-1073740791` (0xC0000409) indicates a stack buffer overrun in the GPU process.

**Affected Files:**
- [`desktop-app/main.js`](desktop-app/main.js) - Electron app initialization

**Suggested Fix:**
Add GPU-related flags to Electron's app initialization:

```javascript
// In main.js, before app.whenReady()
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
// Or for more aggressive fix:
// app.disableHardwareAcceleration();
```

**Notes:**
- This error is usually cosmetic and doesn't affect functionality
- Disabling hardware acceleration may impact performance
- Test thoroughly on multiple Windows machines before deploying

---

### 4. Audio Autoplay Policy Blocking Join Sound

**Error Message:**
```
[AudioManager] Could not play join sound: The play() request was interrupted by a call to pause(). https://goo.gl/LdLk22
```

**Root Cause:**
Modern browsers (including Electron's Chromium) block autoplay of audio until user interaction. The join sound tries to play before the user has interacted with the page.

**Affected Files:**
- [`desktop-app/server/widget.html`](desktop-app/server/widget.html) - AudioManager class (~line 1427)

**Suggested Fix:**
1. Queue audio playback until first user interaction
2. Use Electron's `--autoplay-policy=no-user-gesture-required` flag
3. Show a "Click to enable sounds" prompt on first load

**Code Location to Start:**
```javascript
// Option 1: Add flag in main.js
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Option 2: Queue sounds until interaction
class AudioManager {
    constructor() {
        this.userHasInteracted = false;
        this.pendingSounds = [];
        
        document.addEventListener('click', () => {
            this.userHasInteracted = true;
            this.playPendingSounds();
        }, { once: true });
    }
    
    playSound(sound) {
        if (!this.userHasInteracted) {
            this.pendingSounds.push(sound);
            return;
        }
        // ... play sound
    }
}
```

---

### 5. Content Security Policy Warning

**Error Message:**
```
Electron Security Warning (Insecure Content-Security-Policy) This renderer process has either no Content Security Policy set or a policy with "unsafe-eval" enabled.
```

**Root Cause:**
The application doesn't have a proper Content Security Policy (CSP) header configured, which is a security best practice for Electron apps.

**Affected Files:**
- [`desktop-app/server/widget.html`](desktop-app/server/widget.html) - HTML head section
- [`desktop-app/server/dashboard.html`](desktop-app/server/dashboard.html) - HTML head section
- [`desktop-app/main.js`](desktop-app/main.js) - BrowserWindow configuration

**Suggested Fix:**
Add CSP meta tag to HTML files:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:;">
```

Or configure in main.js:
```javascript
mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
        responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline'"]
        }
    });
});
```

**Notes:**
- This warning only appears in development, not in packaged builds
- CSP configuration requires careful testing to avoid breaking functionality
- Start with a permissive policy and tighten gradually

---

### 6. Chat Bubbles Hidden by Other Sprites (Z-Index Stacking Context)

**Issue Description:**
When multiple users on the same side of the campfire chat simultaneously, chat bubbles from "back" sprites can be hidden behind "front" sprites and their usernames. This occurs because chat bubbles are child elements of their parent sprite containers.

**Root Cause:**
CSS z-index works within stacking contexts. Chat bubbles are child elements of `.user-shape` containers. Even with a high z-index (950), a child element cannot escape its parent's stacking context. If Sprite A (z-index: 500) has a chat bubble (z-index: 950), and Sprite B (z-index: 600) is in front, Sprite B will cover the bubble because the bubble is trapped within Sprite A's stacking context.

```
Stacking Context Hierarchy:
- Sprite A (z-index: 500)
  └── Chat Bubble (z-index: 950) ← Still behind Sprite B!
- Sprite B (z-index: 600) ← Covers Sprite A AND its children
```

**Affected Files:**
- [`desktop-app/server/widget.html`](desktop-app/server/widget.html) - `showChatMessage()` method (~line 3188)
- [`desktop-app/server/widget.html`](desktop-app/server/widget.html) - `.chat-message` CSS (~line 464)

**Why Simple Fixes Don't Work:**
1. Higher z-index on bubble: ❌ Trapped in parent's context
2. `!important`: ❌ Still trapped in parent's context
3. Changing parent z-index: ❌ Would break the 3D depth effect of the campfire circle

**Suggested Fix (Architectural Change):**
Move chat bubbles to a global container outside the sprite hierarchy:

1. Create a global `#chat-bubbles-container` at the widget level (sibling to `.campfire-area`)
2. Calculate absolute positioning based on sprite screen positions
3. Manage bubble lifecycle separately from sprites
4. Update bubble positions when sprites move

```javascript
// Conceptual implementation:
class ChatBubbleManager {
    constructor(container) {
        this.container = container; // Global container, not inside sprites
        this.bubbles = new Map();
    }
    
    createBubble(user, message) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-message';
        bubble.style.position = 'absolute';
        bubble.style.zIndex = 900; // Above all sprites
        // Position based on user's screen coordinates
        this.updatePosition(user, bubble);
        this.container.appendChild(bubble);
    }
    
    updatePosition(user, bubble) {
        const element = document.getElementById(user.id);
        const rect = element.getBoundingClientRect();
        bubble.style.left = `${rect.left + rect.width/2}px`;
        bubble.style.top = `${rect.top - 30}px`;
    }
}
```

**Workaround:**
This is currently a known limitation. Chat bubbles work correctly for:
- Single users chatting
- Users on different sides of the fire
- Most normal usage scenarios

The issue only appears when multiple users on the same side chat simultaneously.

**Priority:** Low - Does not affect core functionality, cosmetic issue only

---

## Recently Fixed Issues

### ✅ Duplicate Join Simulation on Startup (Fixed 2026-01-26)

**Original Error:**
Streamer and bot "joined the campfire" messages appeared twice on startup.

**Root Cause:**
1. `initDesktopMenuBar()` was called multiple times from different event handlers
2. `menuBarInitialized` flag was checked but never set to `true`
3. `hasSimulatedJoins` was declared inside the function, creating a new variable each call

**Fix Applied:**
- Moved `hasSimulatedJoins` to module level ([`widget.html:6812`](desktop-app/server/widget.html:6812))
- Added `menuBarInitialized = true` immediately after the duplicate check ([`widget.html:6824`](desktop-app/server/widget.html:6824))

---

## How to Add New Issues

When discovering a new issue, add it to this document with:

1. **Error Message** - The exact error from console/terminal
2. **Root Cause** - Analysis of why the error occurs
3. **Affected Files** - List of files that need modification
4. **Suggested Fix** - Code snippets or approach to resolve
5. **Priority** - High/Medium/Low based on user impact

Follow the [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for coding standards and architecture patterns when implementing fixes.
