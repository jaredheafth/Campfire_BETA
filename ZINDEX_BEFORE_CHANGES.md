# Z-Index Values BEFORE Changes

This document records the current z-index values in `desktop-app/server/widget.html` before making any modifications.

**Date:** 2026-01-29
**File:** desktop-app/server/widget.html

---

## CSS Z-Index Values

| Element | Line | Current Z-Index | Notes |
|---------|------|-----------------|-------|
| `.campfire-graphic` | 118 | 10 | Campfire container |
| `.user-shape.front-layer` | 135 | 15 | Sprites in front |
| `.user-shape.back-layer` | 140 | 5 | Sprites in back |
| `.user-shape` (default) | 167 | 5 | Default sprite z-index |
| `.user-shape .state-ring` | 183 | -1 | Behind sprite |
| `.sleepy-indicator` | 246 | 10 | Status icon |
| `.afk-indicator` | 286 | 10 | Status icon |
| `.lurk-indicator` | 342 | 10 | Status icon |
| `.user-shape .username` | 443 | 100 | Username label |
| `.user-shape .chat-message` | 478 | 25 | Chat bubble |
| `.sparkle-particle` | 618 | 9999 | Effect particle |
| `.desktop-menu-bar` | 761 | 999999 | Menu bar (extremely high) |
| `.dashboard-overlay` | 1007 | 50000 | Dashboard modal |

---

## JavaScript Z-Index Values

### positionUserElement() method (around line 4920-5020)

```javascript
// Sprite z-index calculation (lines 4925-4934)
const minZIndex = 5;      // Furthest back
const maxZIndex = 24;     // Closest/front
let zIndex = minZIndex + Math.floor(normalizedY * zIndexRange);

// Outer ring boost (lines 4939-4943)
if (user.outerRing && normalizedY < 0.3) {
    zIndex = 1000000 + zIndex;  // EXTREME boost to 1,000,005+
}

// Username z-index override (line 4993)
usernameLabel.style.zIndex = zIndex.toString();  // Sets to 5-24 range

// Chat bubble z-index override (line 5014)
chatMessage.style.zIndex = zIndex.toString();  // Sets to 5-24 range
```

### createUserElement() - Chat message creation (around line 3250-3255)

```javascript
// Copies username z-index to chat message
const z = window.getComputedStyle(usernameLabel).zIndex;
if (z) chatMessage.style.zIndex = z;
```

### updateUserElements() - Color update (around line 4655-4657)

```javascript
// Also copies username z-index to chat message
chatMessage.style.zIndex = window.getComputedStyle(usernameLabel).zIndex;
```

---

## Inline Style Z-Index Values (Campfire Elements)

| Element | Line | Z-Index | Context |
|---------|------|---------|---------|
| `#campfireFlicker` | 2518 | 12 | Default campfire |
| `#campfireEmoji` | 2520 | 11 | Default campfire |
| `#campfireGlow` | 2578 | 10 | Custom campfire |
| Video/Image element | 2586-2596 | 11 | Custom campfire media |
| `#campfireFlicker` | 2602 | 12 | Custom campfire front layer |

---

## Problems Identified

1. **Username conflict**: CSS says 100, JS overrides to 5-24
2. **Chat bubble layering**: CSS says 25, JS overrides to match sprite (5-24)
3. **Status icons at wrong layer**: All at 10, same as campfire glow
4. **Extreme outer ring boost**: 1,000,000+ z-index values
5. **Menu bar too high**: 999999 is excessive
6. **Inconsistent chat bubble behavior**: Sometimes copies username, sometimes uses CSS
