# Campfire Widget - Codebase Issues & Refactor Plan

**Document Created:** 2026-01-25  
**Purpose:** Reference document for tracking all identified issues, architectural flaws, and the plan to address them systematically.

---

## Table of Contents

1. [Issue 1: Visual Display Window Problems](#issue-1-visual-display-window-problems)
2. [Issue 2: Duplicate Users & State Management](#issue-2-duplicate-users--state-management)
3. [Issue 3: Commands Tab Functionality](#issue-3-commands-tab-functionality)
4. [Architectural Issues](#architectural-issues)
5. [Refactor Plan & Recommendations](#refactor-plan--recommendations)
6. [Implementation Roadmap](#implementation-roadmap)

---

## Issue 1: Visual Display Window Problems

### 1.1 Sprites Disappearing on Outer Ring

**Symptom:** Sprites on the outer ring (AFK/LURK users) disappear or are hidden at the top segment of the ring, but are visible on the sides.

**Root Cause Analysis:**

| File | Line | Problem |
|------|------|---------|
| `widget.html` | 75-86 | `.campfire-area` uses `min(100vw, 100vh)` with `min-width/height: 600px` |
| `widget.html` | 4680 | Outer ring multiplier is `1.67x` normal radius |
| `widget.html` | 3339-3346 | Outer ring arc is 190°-350° (back/top of campfire) |

**Technical Details:**
- The outer ring radius = `circleRadius * 1.67` (approximately 200px when base is 120px)
- When window is 600x600, the campfire area is 600x600
- Outer ring sprites at angles 190°-350° position at negative Y values (above center)
- These sprites extend beyond the container boundaries and get clipped

**Agreed Solution:**
- Content (sprites, glow, fire, animations, chat bubbles, usernames) should NEVER be cut off
- Adjust containers/canvases/dimensions to ensure all content is visible
- When window is resized smaller, either:
  - Stop the resize at a calculated minimum that fits all content, OR
  - Scale down content proportionally to fit

**Recommendation:** Implement **content scaling** approach:
1. Calculate the minimum container size needed to fit outer ring + sprite size + padding
2. When window is smaller than this minimum, scale the entire campfire area using CSS `transform: scale()`
3. This preserves visual fidelity while allowing smaller windows

---

### 1.2 Window Dimension Lock/Unlock Bugs

**Symptom:** The lock/unlock feature doesn't reliably prevent resizing.

**Root Cause Analysis:**

| File | Line | Problem |
|------|------|---------|
| `main.js` | 295-321 | Resize handler only saves when unlocked, doesn't enforce locked size |
| `main.js` | 709-711 | `setResizable(!locked)` may not prevent OS-level window snapping |
| `main.js` | 717-732 | Race condition in toggle-window-lock handler |

**Agreed Solution:**
- Window lock should prevent ALL resizing (drag, scale, OS snapping)
- Only way to change dimensions when locked: unlock → drag/type dimensions → apply
- Streamers can leave unlocked if preferred

**Recommendation:**
1. Use Electron's `setResizable(false)` combined with `setMinimumSize()` and `setMaximumSize()` set to same values when locked
2. Add resize event listener that immediately reverts to locked dimensions if changed
3. Store locked state in persistent settings

---

### 1.3 Scrollbars Appearing

**Symptom:** Scrollbars appear at certain window dimensions.

**Root Cause Analysis:**

| File | Line | Problem |
|------|------|---------|
| `widget.html` | 32 | `body { overflow: visible }` allows scrollbars |
| `widget.html` | 80-81 | `min-width/height: 600px` creates content larger than viewport |

**Agreed Solution:**
- Scrollbars should NEVER appear - this is unprofessional for a streaming widget
- Content should scale to fit, not overflow

**Recommendation:**
1. Set `html, body { overflow: hidden }` to prevent scrollbars entirely
2. Implement content scaling (see 1.1) to handle small windows
3. Remove fixed `min-width/min-height` from `.campfire-area` - let scaling handle it

---

## Issue 2: Duplicate Users & State Management

### 2.1 Multiple Sources of Truth

**Symptom:** Duplicate usernames appear in the members list, causing conflicts with sprite control.

**Root Cause Analysis:**

| Location | Storage | Key Type | Purpose |
|----------|---------|----------|---------|
| `main.js` | `activeUsers` Map | userId (string) | Joined campfire members |
| `main.js` | `allChatters` Map | username | Potential members from chat |
| `widget.html` | `this.users` Array | generated id | Visual sprite instances |
| `localStorage` | `campfireUsers` | mixed | Persisted users (problematic) |
| `dashboard.html` | `allMembers` Array | mixed | Aggregated display list |

**Technical Details:**
- `widget.html:2508-2521` - `addUser()` matches by 4 different criteria, creating duplicate scenarios
- `dashboard.html:6134-6156` - `upsert()` function can create different keys for same user
- No single canonical identifier used consistently

**Agreed Solution:**
- Use **Twitch userId** as the single source of truth (Twitch's stable identifier)
- Users in chat but not joined should have state "In Chat"
- **Eliminate persisted users feature** - all users LEAVE on app shutdown
- On startup, load fresh from Twitch API with all members starting as "In Chat"

**Recommendation:**
1. Create a centralized `UserManager` class in main process
2. Single `Map<userId, UserData>` as the only source of truth
3. Widget receives user data via IPC, doesn't maintain its own user list
4. Dashboard reads from main process, doesn't aggregate from multiple sources
5. Remove all localStorage user persistence

---

### 2.2 User States

**Current States (inconsistent implementation):**
- JOINED - User has joined the campfire
- ACTIVE - User recently chatted
- SLEEPY - User hasn't chatted in a while
- AFK - User hasn't chatted for a long time
- LURK - User manually entered lurk mode
- (Missing) IN_CHAT - User is in Twitch chat but hasn't joined

**Agreed Solution:**
- Add proper "In Chat" state for users who appear in chat but haven't joined
- Clear state machine transitions:

```
IN_CHAT → (join command) → JOINED → ACTIVE
ACTIVE → (no activity) → SLEEPY → AFK
ACTIVE/SLEEPY/AFK → (!lurk) → LURK
LURK/AFK → (!join) → ACTIVE
ANY → (!leave or app shutdown) → REMOVED
```

---

## Issue 3: Commands Tab Functionality

### 3.1 Bot Messages Storage Split

**Symptom:** Commands don't work reliably, settings don't persist correctly.

**Root Cause Analysis:**

| File | Line | Storage Location |
|------|------|------------------|
| `preload.js` | 112-131 | `localStorage.botMessages` (renderer) |
| `main.js` | 1623-1724 | `botMessagesCache` array (main process) |

**Problem:** Two separate storages that can get out of sync.

**Agreed Solution:**
- All commands should be fully customizable (trigger words + responses)
- Even built-in actions should have editable bot message responses
- Default responses provided, but all editable by streamer

**Recommendation:**
1. Store commands in main process only (file-based, not localStorage)
2. Dashboard reads/writes via IPC
3. Single source of truth eliminates sync issues

---

### 3.2 Silent Mode Clarification

**Agreed Behavior:**
- SILENT hides the **user's command message** (e.g., "!cw 45")
- Currently only affects Pop Out Chat (we control it)
- Future: Could also hide from Twitch chat with proper bot permissions
- Internal Dashboard Chat is UNAFFECTED - always shows everything for debugging

**Implementation Notes:**
- With proper Twitch moderator permissions, bot can delete user messages
- Requires `channel:moderate` scope on bot account
- This is a future enhancement, not immediate priority

---

### 3.3 Response Routing

**Current State:** Confusing toggles with unclear behavior.

**Agreed Solution:**
- Each command should have checkboxes for each chat destination:
  - [ ] Internal Chat (Dashboard)
  - [ ] Pop Out Chat
  - [ ] Twitch Chat
- Streamer can select any combination per command
- Extensible: Adding new chat types = adding new checkbox

**Recommendation:**
```javascript
// Command structure
{
  id: 'spin',
  triggers: ['!spin', '!rotate'],
  response: '{username} spins!',
  enabled: true,
  silent: false, // Hide user's command message
  destinations: {
    internal: true,   // Always true for debugging
    popout: true,
    twitch: true
  },
  allowNonCampers: false,
  category: 'ANIMATION'
}
```

---

## Architectural Issues

### 4.1 Monolithic File Structure

**Current State:**
- `main.js`: ~4700+ lines, 113+ functions
- `widget.html`: ~7600+ lines (HTML + CSS + JS mixed)
- `dashboard.html`: Similarly massive

**Problems:**
- Impossible to extend without touching existing logic
- No separation of concerns
- Difficult to test individual components
- High risk of regression when making changes

---

### 4.2 State Management Chaos

**Current State Locations:**
```
┌─────────────────────────────────────────────────────────────┐
│ main.js:                                                    │
│   - activeUsers (Map)                                       │
│   - allChatters (Map)                                       │
│   - botMessagesCache (Array)                                │
│   - windowDimensions (Object)                               │
│   - twitchConfig (Object)                                   │
│   - events (Array)                                          │
├─────────────────────────────────────────────────────────────┤
│ widget.html:                                                │
│   - this.users (Array)                                      │
│   - this.settings (Object)                                  │
│   - localStorage.campfireUsers                              │
│   - localStorage.campfireWidgetState                        │
│   - localStorage.allViewerColors                            │
├─────────────────────────────────────────────────────────────┤
│ dashboard.html:                                             │
│   - allMembers (Array)                                      │
│   - activeUsers (Array)                                     │
│   - memberMuteStates (Object)                               │
│   - memberStillStates (Object)                              │
│   - localStorage.botMessages                                │
│   - localStorage.campfireUsers                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.3 No Event Bus / Pub-Sub Pattern

- 70+ different IPC channels with no central registry
- Easy to miss updating listeners when adding features
- No documentation of message contracts

---

### 4.4 Hardcoded Magic Numbers

| Value | Location | Purpose |
|-------|----------|---------|
| `600` | Multiple | Minimum window dimensions |
| `1.67` | widget.html:4680 | Outer ring multiplier |
| `190°-350°` | widget.html:3339-3346 | Outer ring arc |
| `30000` | widget.html:3550 | State update interval (ms) |
| `120` | widget.html | Default circle radius |

---

### 4.5 Missing Abstractions

- No `User` class/model - plain objects with inconsistent shapes
- No `Command` class - objects with varying properties
- No State Machine for user states
- No configuration constants module

---

### 4.6 Duplicate/Legacy Code

- `main.js` and `main-desktop-v2.js` with overlapping functionality
- `preload.js` and `preload-desktop-v2.js` similarly
- Multiple `.old` and `.backup` files

---

## Refactor Plan & Recommendations

### Recommended Approach: Event-Driven Architecture with Centralized State

**Why This Approach:**
1. **Single Source of Truth** - All state lives in main process
2. **Event-Driven** - Components communicate via well-defined events
3. **Extensible** - Adding new features = adding new event handlers
4. **Testable** - Each module can be tested in isolation

### Proposed Directory Structure

```
desktop-app/
├── src/
│   ├── main/
│   │   ├── index.js              # Entry point, app lifecycle
│   │   ├── windows/
│   │   │   ├── WidgetWindow.js
│   │   │   ├── DashboardWindow.js
│   │   │   ├── ChatPopoutWindow.js
│   │   │   └── index.js
│   │   ├── state/
│   │   │   ├── UserManager.js    # Single source of truth for users
│   │   │   ├── CommandManager.js # Command definitions and execution
│   │   │   ├── SettingsManager.js
│   │   │   └── index.js
│   │   ├── twitch/
│   │   │   ├── TwitchClient.js   # IRC connection
│   │   │   ├── TwitchAPI.js      # Helix API calls
│   │   │   └── EmoteManager.js   # Third-party emotes
│   │   ├── ipc/
│   │   │   ├── channels.js       # Central IPC channel registry
│   │   │   └── handlers.js       # IPC handler registration
│   │   └── constants.js          # All magic numbers
│   ├── renderer/
│   │   ├── widget/
│   │   │   ├── widget.html
│   │   │   ├── widget.css
│   │   │   └── widget.js
│   │   ├── dashboard/
│   │   │   ├── dashboard.html
│   │   │   ├── dashboard.css
│   │   │   └── dashboard.js
│   │   └── shared/
│   │       └── styles.css
│   └── preload/
│       └── preload.js            # Minimal, just exposes IPC
├── server/                       # Keep for assets (sprites, fonts)
│   ├── sprites/
│   └── fonts/
└── package.json
```

### State Management Recommendation

**Simple Event Emitter Pattern** (not Redux/MobX - overkill for Electron)

```javascript
// src/main/state/UserManager.js
class UserManager extends EventEmitter {
  constructor() {
    super();
    this.users = new Map(); // userId -> UserData
  }

  addUser(userId, userData) {
    const user = new User(userId, userData);
    this.users.set(userId, user);
    this.emit('user:added', user);
    return user;
  }

  updateUserState(userId, newState) {
    const user = this.users.get(userId);
    if (user) {
      const oldState = user.state;
      user.setState(newState);
      this.emit('user:stateChanged', { user, oldState, newState });
    }
  }

  removeUser(userId) {
    const user = this.users.get(userId);
    if (user) {
      this.users.delete(userId);
      this.emit('user:removed', user);
    }
  }

  // Called on app shutdown
  removeAllUsers() {
    for (const [userId, user] of this.users) {
      this.emit('user:removed', user);
    }
    this.users.clear();
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Do First)
**Goal:** Establish single source of truth, eliminate duplicates

1. **Create UserManager class** in main process
   - Single Map<userId, User> storage
   - Event emitter for state changes
   - Remove all localStorage user persistence

2. **Create constants.js**
   - Move all magic numbers to one file
   - Export named constants

3. **Simplify IPC**
   - Create central channel registry
   - Document all message contracts

**Estimated Effort:** 2-3 days

---

### Phase 2: Fix Critical Bugs
**Goal:** Resolve the three main issues

1. **Fix outer ring clipping**
   - Implement content scaling
   - Remove scrollbars
   - Calculate proper minimum dimensions

2. **Fix window lock**
   - Proper Electron window constraints
   - Immediate revert on unauthorized resize

3. **Fix Commands tab**
   - Single storage location
   - Proper destination checkboxes
   - Silent mode implementation

**Estimated Effort:** 2-3 days

---

### Phase 3: Refactor Structure
**Goal:** Break monolithic files into modules

1. **Extract main.js into modules**
   - Window management
   - Twitch integration
   - Command handling
   - State management

2. **Extract widget.html**
   - Separate CSS file
   - Separate JS file
   - Clean HTML structure

3. **Extract dashboard.html**
   - Same treatment as widget

**Estimated Effort:** 3-5 days

---

### Phase 4: Polish & Documentation
**Goal:** Production-ready codebase

1. **Add comprehensive tests**
2. **Document all IPC channels**
3. **Create developer guide**
4. **Remove legacy/backup files**

**Estimated Effort:** 2-3 days

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-25 | Use Twitch userId as canonical identifier | Twitch's stable identifier, future-proof |
| 2026-01-25 | Eliminate persisted users | Causes sync issues, fresh start is cleaner |
| 2026-01-25 | Content scaling over minimum enforcement | Better UX, allows smaller windows |
| 2026-01-25 | Event emitter over Redux | Simpler, sufficient for Electron app |
| 2026-01-25 | Checkbox per chat destination | Extensible, clear UX |

---

## Files to Backup Before Refactor

```
desktop-app/main.js
desktop-app/preload.js
desktop-app/server/widget.html
desktop-app/server/dashboard.html
desktop-app/server/chat-popout.html
desktop-app/server/settings-window.html
desktop-app/server/members-window.html
```

---

## Next Steps

1. ✅ Document created
2. ⬜ Create backup of current codebase
3. ⬜ Begin Phase 1: Foundation
4. ⬜ Create UserManager class
5. ⬜ Create constants.js
6. ⬜ Create IPC channel registry
