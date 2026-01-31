# Z-Index Values AFTER Changes

This document records the new z-index values in `desktop-app/server/widget.html` after the reorganization.

**Date:** 2026-01-29
**File:** desktop-app/server/widget.html

---

## New Z-Index Architecture

| Layer | Z-Index Range | Elements | Purpose |
|-------|---------------|----------|---------|
| **UI Overlay** | 1000+ | Desktop menu bar (1000), Dashboard overlay (5000) | Always on top UI |
| **Effects** | 900-999 | Sparkle particles (9999→900) | Visual effects |
| **Chat Bubbles** | 800 | Chat messages (fixed) | Always above usernames |
| **Usernames** | 700-999 | Username labels (700 + sprite offset) | Above sprites, below bubbles |
| **Status Icons** | 600 | Sleepy 💤, AFK, Lurk 👁️ | Above sprite, below username |
| **Front Sprites** | 300-599 | Sprites in front of campfire | Closest to viewer |
| **Campfire Front** | 400 | Flicker glow | Front campfire effect |
| **Campfire** | 300-410 | Fire emoji/image (410), Base glow (300) | Main campfire |
| **Back Sprites** | 100-299 | Sprites behind campfire | Furthest from viewer |
| **State Rings** | -1 | Active/joined/AFK/lurk rings | Behind sprite shape |

---

## CSS Changes Made

| Element | Old Z-Index | New Z-Index | Line |
|---------|-------------|-------------|------|
| `.user-shape .username` | 100 | *removed* | ~443 |
| `.user-shape .chat-message` | 25 | 800 | ~478 |
| `.sleepy-indicator` | 10 | 600 | ~246 |
| `.afk-indicator` | 10 | 600 | ~286 |
| `.lurk-indicator` | 10 | 600 | ~342 |
| `.desktop-menu-bar` | 999999 | 1000 | ~761 |

---

## JavaScript Changes Made

### positionUserElement() method

**Old:**
```javascript
const minZIndex = 5;
const maxZIndex = 24;
// ... extreme boost:
if (user.outerRing && normalizedY < 0.3) {
    zIndex = 1000000 + zIndex;
}
usernameLabel.style.zIndex = zIndex.toString();  // 5-24 or 1000005+
chatMessage.style.zIndex = zIndex.toString();  // 5-24
```

**New:**
```javascript
const minZIndex = 100;
const maxZIndex = 599;
// ... no extreme boost
const usernameZIndex = 700 + (zIndex - minZIndex);  // 700-999
usernameLabel.style.zIndex = usernameZIndex.toString();
// chatMessage z-index is NOT overridden - uses CSS value 800
```

### Chat message creation (showChatMessage)

**Old:**
```javascript
const z = window.getComputedStyle(usernameLabel).zIndex;
if (z) chatMessage.style.zIndex = z;
```

**New:**
```javascript
// DO NOT override z-index - CSS sets it to 800
```

### Color update (updateUserElements)

**Old:**
```javascript
chatMessage.style.zIndex = window.getComputedStyle(usernameLabel).zIndex;
```

**New:**
```javascript
// DO NOT override z-index - CSS sets it to 800
```

---

## Visual Layering Result

```
┌─────────────────────────────────────┐
│  Menu Bar (1000)                    │
├─────────────────────────────────────┤
│  Sparkles (900)                     │
├─────────────────────────────────────┤
│  Chat Bubbles (800)                 │
│  "Hello!"  "Hi there!"              │
├─────────────────────────────────────┤
│  Usernames (700-999)                │
│  User1    User2    User3            │
├─────────────────────────────────────┤
│  Status Icons (600)                 │
│  💤 👁️                               │
├─────────────────────────────────────┤
│  Front Sprites (300-599)            │
│     [S3]       [S4]                 │
├─────────────────────────────────────┤
│  Campfire Flicker (400)             │
│  Campfire Image (410) 🔥            │
│  Campfire Glow (300)                │
├─────────────────────────────────────┤
│  Back Sprites (100-299)             │
│  [S1]            [S2]               │
└─────────────────────────────────────┘
```

---

## Problems Fixed

1. ✅ **Username z-index conflict** - CSS no longer sets static value, JS sets proper 700-999 range
2. ✅ **Chat bubble layering** - Fixed at 800, always above usernames
3. ✅ **Status icons** - Now at 600, properly between sprites and usernames
4. ✅ **Extreme outer ring boost** - Removed 1,000,000+ values
5. ✅ **Menu bar** - Reduced from 999999 to reasonable 1000
6. ✅ **Consistent chat bubble behavior** - No longer copies username z-index
