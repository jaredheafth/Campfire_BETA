# Campfire Widget - Developer Guide

## Welcome

This document is your essential reading before working on ANY task in this codebase. It captures the vision, principles, and architectural standards that must guide every decision you make. Read this completely before writing a single line of code.

---

## Table of Contents

1. [Project Vision](#project-vision)
2. [Core Principles](#core-principles)
3. [Architectural Standards](#architectural-standards)
4. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
5. [Decision Framework](#decision-framework)
6. [Code Quality Standards](#code-quality-standards)
7. [Testing Philosophy](#testing-philosophy)
8. [Documentation Requirements](#documentation-requirements)
9. [Common Pitfalls & Lessons Learned](#common-pitfalls--lessons-learned)
10. [File Structure & Ownership](#file-structure--ownership)

---

## Project Vision

### What We're Building

Campfire Widget is a **Twitch stream overlay application** that displays viewer sprites in a visual campfire scene. Viewers can interact via chat commands, and streamers can customize the experience through a dashboard.

### The Goal

Build an application that:
- **Works reliably** for streamers during live broadcasts (no crashes, no visual glitches)
- **Scales gracefully** as features are added over months/years
- **Can be extended** by any developer without touching existing logic
- **Provides consistent experiences** for all users (no edge cases that break for some)

### What We're NOT Building

- A quick prototype that "just works for now"
- A monolithic codebase where everything is interconnected
- An app that requires the original developer to maintain it
- A system held together by workarounds and band-aids

---

## Core Principles

### 1. No Placeholder Logic

**The Rule**: If a feature cannot be implemented correctly, don't implement it at all. Never use placeholder values, temporary IDs, or "good enough" solutions.

**Why**: Placeholder logic creates technical debt that compounds. A placeholder ID today becomes a duplicate user bug tomorrow, which becomes a data corruption issue next month.

**Example - BAD**:
```javascript
// DON'T DO THIS
const userId = user.twitchId || 'placeholder-' + Date.now();
```

**Example - GOOD**:
```javascript
// DO THIS
const userId = user.twitchId;
if (!userId) {
    console.warn(`User ${user.username} has no Twitch ID - cannot proceed`);
    notifyUser('Please connect your Twitch account to use this feature');
    return;
}
```

### 2. Single Source of Truth

**The Rule**: Every piece of data should have exactly ONE authoritative location. All other code reads from that location.

**Why**: Multiple sources of truth lead to inconsistencies, race conditions, and bugs that are nearly impossible to debug.

**Example - BAD**:
```javascript
// Data stored in multiple places
user.spritesByMode['rpg'] = sprite;
localStorage.setItem('userSprite', sprite);
element.dataset.sprite = sprite;
```

**Example - GOOD**:
```javascript
// Single source of truth
class UserManager {
    setUserSprite(userId, mode, sprite) {
        this.users.get(userId).sprites[mode] = sprite;
        this.persist(); // Saves to localStorage
        this.emit('spriteChanged', { userId, mode, sprite }); // Notifies UI
    }
}
```

### 3. Fail Loudly, Not Silently

**The Rule**: When something goes wrong, make it obvious. Log errors, show user notifications, throw exceptions. Never swallow errors or continue with invalid state.

**Why**: Silent failures create bugs that are impossible to diagnose. Users experience broken behavior with no indication of what went wrong.

**Example - BAD**:
```javascript
// DON'T DO THIS
try {
    await loadSprite(user);
} catch (e) {
    // Silently continue with no sprite
}
```

**Example - GOOD**:
```javascript
// DO THIS
try {
    await loadSprite(user);
} catch (e) {
    console.error(`[loadSprite] Failed for ${user.username}:`, e);
    this.showUserError(`Could not load sprite: ${e.message}`);
    // Don't continue - let the user know and stop
    throw e;
}
```

### 4. Synchronous Decisions, Asynchronous Execution

**The Rule**: Make all important decisions (what sprite to show, what action to take) synchronously BEFORE starting async operations. Don't change decisions based on async results.

**Why**: Async operations can complete in any order. If decisions depend on async results, you get race conditions and inconsistent behavior.

**Example - BAD**:
```javascript
// DON'T DO THIS
createUserElement(user) {
    const element = document.createElement('div');
    container.appendChild(element);
    
    // Decision made AFTER async operation
    loadSprite(user).then(sprite => {
        if (sprite) {
            element.style.backgroundImage = sprite;
        } else {
            element.style.backgroundColor = 'red'; // Fallback
        }
    });
}
```

**Example - GOOD**:
```javascript
// DO THIS
createUserElement(user) {
    // Decision made SYNCHRONOUSLY
    const sprite = this.spriteRegistry.getSpriteForUser(user.id);
    
    const element = document.createElement('div');
    const img = document.createElement('img');
    img.src = sprite; // Already decided
    
    // Async is just for loading, not deciding
    img.onload = () => this.showElement(element);
    img.onerror = () => console.error('Sprite failed to load');
    
    element.appendChild(img);
    container.appendChild(element);
}
```

### 5. No Runtime Fallbacks

**The Rule**: Don't create fallback behavior that triggers at runtime based on failures. If something can fail, handle it at the decision point, not after the fact.

**Why**: Runtime fallbacks create visual glitches (like circles appearing behind sprites), inconsistent state, and are nearly impossible to debug.

**Example - BAD**:
```javascript
// DON'T DO THIS
setTimeout(() => {
    if (!spriteLoaded) {
        showFallbackCircle(); // Creates duplicate element!
    }
}, 3000);
```

**Example - GOOD**:
```javascript
// DO THIS
const sprite = this.getSprite(user);
if (!sprite) {
    // Handle at decision point
    sprite = this.generateDefaultCircle(user);
}
// Now proceed with the single, decided sprite
```

### 6. Explicit Over Implicit

**The Rule**: Make code behavior obvious. Use clear variable names, explicit type checks, and obvious control flow. Avoid magic values, implicit conversions, and clever tricks.

**Why**: Code is read 10x more than it's written. Future developers (including you in 6 months) need to understand what's happening instantly.

**Example - BAD**:
```javascript
// DON'T DO THIS
const id = data?.user?.id || data?.userId || 'user';
if (id) doSomething(id);
```

**Example - GOOD**:
```javascript
// DO THIS
const userId = this.extractUserId(data);
if (!userId) {
    console.warn('No valid user ID found in data:', data);
    return;
}
doSomething(userId);

extractUserId(data) {
    if (data?.user?.id && typeof data.user.id === 'string') {
        return data.user.id;
    }
    if (data?.userId && typeof data.userId === 'string') {
        return data.userId;
    }
    return null;
}
```

---

## Architectural Standards

### State Management

```
┌─────────────────────────────────────────────────────────────┐
│                    STATE ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  MAIN PROCESS (Electron)                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ UserManager (Single Source of Truth)                 │   │
│  │ - All user data                                      │   │
│  │ - Sprite assignments                                 │   │
│  │ - Preferences                                        │   │
│  │ - Persists to disk                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          │ IPC                               │
│                          ▼                                   │
│  RENDERER PROCESSES (Widget, Dashboard, etc.)               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Read-only views of state                             │   │
│  │ - Request changes via IPC                            │   │
│  │ - Receive updates via events                         │   │
│  │ - Never modify state directly                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action** → Dashboard button click
2. **IPC Request** → `electronAPI.updateUserSprite(userId, sprite)`
3. **Main Process** → `UserManager.setSprite(userId, sprite)`
4. **Persistence** → Save to disk
5. **IPC Broadcast** → `spriteChanged` event to all windows
6. **UI Update** → Widget receives event, updates display

### Module Boundaries

Each module should:
- Have a single, clear responsibility
- Expose a minimal public API
- Hide implementation details
- Not depend on other modules' internals

```javascript
// GOOD: Clear module boundary
class UserManager {
    // Public API
    getUser(id) { ... }
    updateUser(id, data) { ... }
    
    // Private implementation
    #users = new Map();
    #persist() { ... }
}

// BAD: Leaky abstraction
class UserManager {
    users = new Map(); // Exposed internal state!
    getUser(id) { return this.users.get(id); }
}
```

---

## Anti-Patterns to Avoid

### 1. The "Quick Fix"

**Symptom**: Adding code to handle a specific edge case without understanding the root cause.

**Problem**: Creates spaghetti code, doesn't actually fix the issue, makes future debugging harder.

**Solution**: Always find the root cause. If a sprite appears behind another sprite, don't add z-index hacks - find out WHY two sprites are being created.

### 2. The "Fallback Chain"

**Symptom**: `value || fallback1 || fallback2 || fallback3 || 'default'`

**Problem**: Hides bugs, makes behavior unpredictable, impossible to debug.

**Solution**: Validate data at entry points. If data is invalid, fail explicitly.

### 3. The "Global State Mutation"

**Symptom**: Functions that modify global variables or shared state without clear ownership.

**Problem**: Race conditions, unpredictable behavior, impossible to test.

**Solution**: Use a state manager with clear ownership. All mutations go through defined methods.

### 4. The "Timeout Fix"

**Symptom**: Using `setTimeout` to "wait for things to settle" or "ensure order".

**Problem**: Timing-dependent code fails under different conditions (slow computers, high load).

**Solution**: Use proper async/await, events, or callbacks. If you need a timeout, you have a design problem.

### 5. The "Copy-Paste Solution"

**Symptom**: Similar code in multiple places with slight variations.

**Problem**: Bugs must be fixed in multiple places, inconsistent behavior, maintenance nightmare.

**Solution**: Extract common logic into shared functions or classes.

---

## Decision Framework

When facing a technical decision, ask these questions in order:

### 1. Does this create a single source of truth?
If your change creates a second place where data is stored or decisions are made, reconsider.

### 2. Will this work in ALL cases?
If your solution only works for "most" users or "typical" scenarios, it's not a solution.

### 3. Can another developer understand this in 5 minutes?
If your code requires extensive comments to explain, simplify it.

### 4. What happens when this fails?
Every operation can fail. What does the user see? What gets logged? Is the system in a valid state?

### 5. Will this still work when we add Feature X?
Consider future features. Will your solution need to be rewritten?

### 6. Am I solving the symptom or the cause?
If you're adding code to handle a specific edge case, you're probably solving a symptom.

---

## Code Quality Standards

### Naming Conventions

```javascript
// Classes: PascalCase
class UserManager { }
class SpriteRegistry { }

// Functions/Methods: camelCase, verb-first
function getUserById(id) { }
function createUserElement(user) { }
function handleTwitchMessage(message) { }

// Variables: camelCase, descriptive
const currentUser = ...;
const spriteLoadTimeout = ...;
const isConnectedToTwitch = ...;

// Constants: SCREAMING_SNAKE_CASE
const MAX_USERS = 100;
const DEFAULT_SPRITE_SIZE = 40;
const TWITCH_API_BASE_URL = '...';

// Private members: prefix with #
class User {
    #internalState = {};
    #calculateSomething() { }
}
```

### Function Structure

```javascript
/**
 * Brief description of what this function does.
 * 
 * @param {string} userId - The Twitch user ID
 * @param {Object} options - Configuration options
 * @returns {User|null} The user object or null if not found
 */
function getUser(userId, options = {}) {
    // 1. Validate inputs
    if (!userId || typeof userId !== 'string') {
        console.warn('[getUser] Invalid userId:', userId);
        return null;
    }
    
    // 2. Main logic
    const user = this.users.get(userId);
    
    // 3. Handle edge cases explicitly
    if (!user) {
        console.log(`[getUser] User not found: ${userId}`);
        return null;
    }
    
    // 4. Return result
    return user;
}
```

### Error Handling

```javascript
// Always use try-catch for async operations
async function loadUserData(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        // Log with context
        console.error(`[loadUserData] Failed for userId=${userId}:`, error);
        
        // Re-throw or return null based on whether caller can handle
        throw error;
    }
}
```

### Logging Standards

```javascript
// Use prefixes for easy filtering
console.log('[UserManager] User added:', user.username);
console.warn('[SpriteRegistry] No sprites available for mode:', mode);
console.error('[TwitchAPI] Connection failed:', error);

// Include relevant context
console.log(`[createUserElement] Creating element for ${user.username} (id: ${user.id}, mode: ${spriteMode})`);

// Don't log sensitive data
console.log('[Auth] User authenticated'); // GOOD
console.log('[Auth] Token:', token); // BAD - security risk
```

---

## Testing Philosophy

### What to Test

1. **Public APIs** - Every public method should have tests
2. **Edge Cases** - Empty arrays, null values, invalid inputs
3. **Integration Points** - IPC handlers, Twitch API calls
4. **User Flows** - Complete scenarios like "user joins and gets sprite"

### What NOT to Test

1. **Implementation Details** - Private methods, internal state
2. **Third-Party Code** - Twitch API, Electron APIs
3. **UI Styling** - CSS, animations (use visual testing tools instead)

### Test Structure

```javascript
describe('UserManager', () => {
    describe('getUser', () => {
        it('returns user when found', () => {
            const manager = new UserManager();
            manager.addUser({ id: '123', username: 'test' });
            
            const user = manager.getUser('123');
            
            expect(user).toBeDefined();
            expect(user.username).toBe('test');
        });
        
        it('returns null when user not found', () => {
            const manager = new UserManager();
            
            const user = manager.getUser('nonexistent');
            
            expect(user).toBeNull();
        });
        
        it('handles invalid input gracefully', () => {
            const manager = new UserManager();
            
            expect(manager.getUser(null)).toBeNull();
            expect(manager.getUser(undefined)).toBeNull();
            expect(manager.getUser('')).toBeNull();
        });
    });
});
```

---

## Documentation Requirements

### Every New Feature Needs

1. **Code Comments** - JSDoc for public APIs
2. **README Update** - If it changes user-facing behavior
3. **Architecture Doc** - If it introduces new patterns or systems

### Every Bug Fix Needs

1. **Root Cause Comment** - In the code, explain WHY the bug happened
2. **Changelog Entry** - What was fixed and how

### Every Refactor Needs

1. **Migration Guide** - How to update code that depends on changed APIs
2. **Before/After Examples** - Show the improvement

---

## Common Pitfalls & Lessons Learned

### Lesson 1: Placeholder IDs Cause Duplicates

**What Happened**: We used placeholder IDs like `"streamer"` or `"viewer"` when real Twitch IDs weren't available. This caused duplicate users in the members list because the same placeholder was used for different people.

**The Fix**: Never use placeholder IDs. If we don't have a real ID, don't create the user. Notify them to connect their account.

**Code Reference**: See `getRealTwitchId()` in `main.js`

### Lesson 2: Fallback Timeouts Create Visual Glitches

**What Happened**: We had 3-second timeouts that would show a fallback circle if a sprite didn't load. But the timeout would fire even when sprites loaded successfully (due to blob URL timing), creating circles BEHIND the sprites.

**The Fix**: Remove runtime fallbacks. Decide what to show BEFORE creating elements. If a sprite fails, log an error but don't create a second element.

**Code Reference**: See `SPRITE_SYSTEM_REFACTOR.md`

### Lesson 3: Multiple Code Paths = Multiple Bugs

**What Happened**: User elements could be created by `createUserElement()`, `updateUserElement()`, or `simulateJoinForConnectedUsers()`. Each had slightly different logic, leading to inconsistent behavior.

**The Fix**: Single code path for each operation. All user creation goes through one function. All updates go through one function.

### Lesson 4: Scattered State = Impossible Debugging

**What Happened**: User data was stored in `this.users`, `localStorage`, DOM elements, and various caches. When bugs occurred, we couldn't tell which source was wrong.

**The Fix**: Single source of truth. `UserManager` owns all user data. Everything else reads from it.

---

## File Structure & Ownership

```
desktop-app/
├── main.js                 # Electron main process, IPC handlers
├── preload.js              # Bridge between main and renderer
├── server/
│   ├── widget.html         # Visual display (sprites, animations)
│   ├── dashboard.html      # Streamer control panel
│   ├── settings-window.html # Settings UI
│   └── sprites/            # Sprite assets
└── src/
    └── main/
        ├── state/          # State management classes
        │   ├── UserManager.js
        │   └── SpriteRegistry.js (planned)
        ├── ipc/            # IPC handler definitions
        └── helpers/        # Utility functions
```

### Ownership Rules

- **main.js** owns: Twitch connection, IPC routing, window management
- **UserManager** owns: All user data, persistence
- **widget.html** owns: Visual rendering, animations
- **dashboard.html** owns: Streamer UI, settings forms

### Adding New Features

1. Identify which module should own the feature
2. Add state to the appropriate manager
3. Add IPC handlers if cross-process communication needed
4. Add UI in the appropriate renderer

---

## Final Checklist

Before submitting ANY code change, verify:

- [ ] No placeholder values or temporary IDs
- [ ] Single source of truth for any new data
- [ ] Errors are logged with context
- [ ] No runtime fallbacks that could create duplicates
- [ ] Code is readable without extensive comments
- [ ] Edge cases are handled explicitly
- [ ] No `setTimeout` used for synchronization
- [ ] Public APIs have JSDoc comments
- [ ] Tests cover the happy path and error cases

---

## Questions?

If you're unsure about a decision:

1. Re-read the relevant section of this guide
2. Check existing code for patterns (but verify they follow these principles!)
3. Ask before implementing - it's faster to discuss than to rewrite

Remember: **The goal is not to ship fast, it's to ship RIGHT.**

---

*Document Version: 1.0*
*Last Updated: 2026-01-26*
*Maintainer: Development Team*
