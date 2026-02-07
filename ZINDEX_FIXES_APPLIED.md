# Z-Index Fixes Applied (2026-02-06)

This document records the z-index fixes applied to fix menu button clickability issues on transparent windows.

## Problems Identified

1. **Drag Strip Overlapping Menu Buttons**: The drag strip had `z-index: 999` but was positioned ABOVE the menu bar buttons (at `top: -22px`), causing it to overlap and block clicks on menu buttons.

2. **Menu Buttons Lacked Explicit Z-Index**: Menu buttons didn't have their own z-index, relying on parent inheritance which could cause stacking issues.

3. **Transparent Container Interference**: The widget container didn't have proper pointer-events handling, allowing transparent regions to interfere with menu bar clicks.

## Fixes Applied

### 1. Drag Strip Z-Index (Line ~837)

**Before:**
```css
z-index: 999; /* Just under the menu bar's 1000 to prevent blocking clicks */
```

**After:**
```css
z-index: 998; /* BELOW menu bar buttons (1001) to prevent blocking clicks */
```

### 2. Menu Bar Z-Index (Line ~797)

**Before:**
```css
z-index: 1000 !important; /* Above all widget content, below effects if needed */
```

**After:**
```css
z-index: 1001 !important; /* Above drag strip (998) */
```

### 3. Menu Button Z-Index (Lines ~887, ~935)

**Added:**
```css
z-index: 1002; /* Above drag strip (998) and menu bar (1001) */
```

To:
- `.menu-button`
- `.menu-button-square`
- `.menu-status`

### 4. Widget Container Pointer Events (Line ~74)

**Added:**
```css
pointer-events: none; /* Ensure transparent areas don't interfere with menu bar clicks */
```

**Added:**
```css
/* Re-enable pointer events for interactive elements within widget-container */
.widget-container > * {
    pointer-events: auto;
}
```

## New Z-Index Architecture

| Layer | Z-Index | Elements | Purpose |
|-------|---------|----------|---------|
| **UI Overlay** | 1002 | Menu buttons, status | Highest - Clickable buttons |
| **UI Bar** | 1001 | Desktop menu bar | Container for buttons |
| **Drag Strip** | 998 | Drag handle | Draggable, below buttons |
| **Effects** | 900-999 | Sparkle particles | Visual effects |
| **Chat Bubbles** | 800 | Chat messages | Always above usernames |
| **Usernames** | 700-999 | Username labels | Above sprites, below bubbles |
| **Status Icons** | 600 | Sleepy 💤, AFK, Lurk 👁️ | Above sprite, below username |
| **Front Sprites** | 300-599 | Sprites in front of campfire | Closest to viewer |
| **Campfire Front** | 400 | Flicker glow | Front campfire effect |
| **Campfire** | 300-410 | Fire emoji/image (410), Base glow (300) | Main campfire |
| **Back Sprites** | 100-299 | Sprites behind campfire | Furthest from viewer |
| **State Rings** | -1 | Active/joined/AFK/lurk rings | Behind sprite shape |

## Visual Layering Result

```
┌─────────────────────────────────────┐
│  Menu Buttons (1002)                 │
│  [Dashboard] [Chat] [End]          │
├─────────────────────────────────────┤
│  Menu Bar (1001)                    │
│  ─────────────────────              │
│  Drag Strip (998)                   │
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

## Testing Notes

After applying these fixes:
1. Menu buttons should be immediately clickable without needing to wait or drag
2. The drag strip should still be usable for moving the window
3. All transparent background settings should work correctly
4. Sprite interactions (hover, click) should remain functional

## Related Files

- `desktop-app/server/widget.html` - Main widget with menu bar
- `desktop-app/main.js` - Electron main process (handles transparent windows)
