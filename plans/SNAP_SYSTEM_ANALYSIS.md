# Snap System Analysis & Implementation

## Problem Statement

The Buddy List and Popout Chat windows don't move together when snapped. They still move independently during drag operations.

**Expected Behavior:**
- When windows are snapped (placed close to each other), they should move together as a unit
- Once snapped, windows should NOT be able to be pulled apart by dragging
- Unsnap should only be possible via the detach button (already present)
- After unsnap, windows can be moved separately
- Windows should be able to snap on either side (Buddy left OR Buddy right of Chat)
- Visual feedback (purple glow) should show when windows are close to snapping

## Root Causes Identified

### 1. Electron's `moving` Event Doesn't Fire Reliably

**Location:** [`desktop-app/main.js`](desktop-app/main.js) - chat popout handlers and buddy list handlers

**Issue:** The code relied on the `moving` event to sync positions during drag. However, on Windows with Electron, this event doesn't fire continuously during drag operations - it only fires on release (via `moved` event).

### 2. Bidirectional Event Handlers Caused Oscillation

**Location:** [`desktop-app/main.js`](desktop-app/main.js) - both `chatPopoutWindow.on('moving')` and `buddyListWindow.on('moving')` handlers

**Issue:** Both windows had handlers that tried to move each other, causing oscillation.

### 3. No Single Source of Truth

**Issue:** Snap state was distributed across both window objects instead of being centralized.

### 4. Initial Implementation Had Choppy Movement

The first polling-based implementation had issues:
- 60fps polling was too slow
- Leader re-detection on every poll caused "snap into place" effect
- High movement threshold for slow movements

## Solution Implemented

### SnapManager Class

A centralized [`SnapManager`](desktop-app/main.js) class was implemented with:

1. **Position Polling at ~120fps** (8ms interval)
   - Faster than original 60fps to keep up with native drag
   - Uses `setPosition(targetX, targetY, false)` to skip animation

2. **Leader-Follower Tracking with Sticky Leader**
   - Once a window is identified as leader (being dragged), it STAYS leader until drag ends
   - Prevents the "snap into place" effect when leader switches
   - Uses movement magnitude (>2px) to detect which window is moving

3. **Drag End Detection**
   - Clears leader after 50ms of no movement
   - Prevents leader from being stuck between drags

4. **Immediate Follower Sync**
   - Once leader is established, follower moves immediately without threshold
   - Syncs position on every poll (~120 times per second)

5. **Single Source of Truth**
   - All snap state in one place: `isSnapped`, `snapPosition`, `leaderWindow`
   - Centralized methods: `snap()`, `unsnap()`, `syncHeights()`, `syncFollower()`

6. **Both-Side Snapping Support**
   - Supports `'buddy-left'` (Buddy on left, Chat on right)
   - Supports `'buddy-right'` (Buddy on right, Chat on left)
   - Auto-detects which side to snap based on release position

7. **Visual Snap Guides (Purple Glow)**
   - Purple pulse animation when windows are within snap threshold
   - Edge-specific overlays show where the snap will occur
   - Uses IPC `snap-guide-changed` channel to sync between windows

## DEVELOPER GUIDE Compliance

### Good Practices Followed

| Principle | Implementation |
|-----------|----------------|
| **Single Source of Truth** | SnapManager owns all snap state |
| **Logging with Prefixes** | Using `[SnapManager]` prefix in all console logs |
| **Class Structure** | Proper ES6 class with private methods (using `#` prefix) |
| **No Placeholder Values** | No temporary IDs or placeholders |
| **Fail Loudly** | Errors logged with context |

### Code Quality Improvements Made

1. **Extracted Constants** - All magic numbers extracted to class-level static constants:
   ```javascript
   static POLL_RATE_MS = 8;
   static LEADER_THRESHOLD = 2;
   static DRAG_END_DELAY = 50;
   static SNAP_GAP = 0;
   static SNAP_THRESHOLD = 30;
   static Y_TOLERANCE = 50;
   static SNAP_GUIDE_THRESHOLD = 50;
   ```

2. **Added JSDoc Comments** - All public methods have comprehensive JSDoc:
   ```javascript
   /**
    * Register windows with the snap manager.
    * @param {BrowserWindow} chatWindow - The Chat Popout window
    * @param {BrowserWindow} buddyListWindow - The Buddy List window
    */
   registerWindows(chatWindow, buddyListWindow) { ... }
   ```

3. **Added Error Handling** - All methods have try-catch blocks:
   ```javascript
   #syncHeights() {
       try {
           // Sync logic
       } catch (error) {
           console.error('[SnapManager] Failed to sync heights:', error);
       }
   }
   ```

4. **Private Methods** - Using ES6 private method syntax (`#` prefix):
   ```javascript
   #pollPositions() { ... }
   #syncFollower(leader, chatBounds, buddyBounds) { ... }
   ```

### Key Files Modified

| File | Changes |
|------|---------|
| [`desktop-app/main.js`](desktop-app/main.js) | Added SnapManager class with all improvements |
| [`desktop-app/preload.js`](desktop-app/preload.js) | Added `onSnapGuideChanged` IPC handler |
| [`desktop-app/server/styles/shared-styles.css`](desktop-app/server/styles/shared-styles.css) | Added snap guide CSS (purple glow, animations) |
| [`desktop-app/server/buddy-list.html`](desktop-app/server/buddy-list.html) | Added snap guide overlays and listeners |
| [`desktop-app/server/chat-popout.html`](desktop-app/server/chat-popout.html) | Added snap guide overlays and listeners |

## How Smooth Sync Works

```
User starts dragging Chat window
    │
    ├── SnapManager detects Chat movement (>2px)
    │   └── Sets leaderWindow = 'chat'
    │
    ├── Every 8ms: SnapManager polls positions
    │   ├── Chat moved 5px right
    │   └── Buddy List is follower → moved 5px right immediately
    │
    └── User releases Chat
        └── leaderWindow cleared after 50ms delay
```

**Key insight:** Once leader is established, we DON'T re-detect on every poll. This prevents the follower from "catching up" and snapping into place.

## Visual Snap Guide

### How It Works

1. During drag, SnapManager calculates proximity between windows
2. If within `SNAP_GUIDE_THRESHOLD` (50px), shows purple glow
3. Edge-specific overlay shows which side will snap
4. Guide hides when windows move apart or snap completes

### CSS Classes Applied

```css
.snap-guide-active           /* Applied to window when guide is visible */
.snap-guide-overlay          /* Base overlay styles */
.snap-guide-overlay.snap-left   /* Shows on left edge */
.snap-guide-overlay.snap-right  /* Shows on right edge */
```

### Animation

The snap guide uses a pulsing purple glow animation:
```css
@keyframes snapGuidePulse {
    0%, 100% { box-shadow: inset 0 0 0 2px rgba(145, 71, 255, 0.3); }
    50% { box-shadow: inset 0 0 0 3px rgba(145, 71, 255, 0.6); }
}
```

## Testing Checklist

After implementation, test:

- [ ] Drag Chat window - Buddy List follows smoothly
- [ ] Drag Buddy List window - Chat follows smoothly
- [ ] Slow movements - secondary window still follows
- [ ] Quick direction changes - no "snap into place" effect
- [ ] Snap detection works when releasing windows close together
- [ ] Both-side snapping works (Buddy can snap to left OR right of Chat)
- [ ] Visual snap guide appears when windows are close to snapping
- [ ] Snap guide shows correct edge (left/right) based on snap position
- [ ] Detach button properly unsnaps windows
- [ ] Windows can be moved independently after detach
- [ ] Height sync works during resize operations

## Technical Notes

### Event Timeline

1. User starts dragging Chat (OS-level drag)
2. SnapManager polls positions at 8ms intervals
3. Detects Chat moved, Buddy List didn't
4. Sets `leaderWindow = 'chat'`
5. On every poll, moves Buddy List to maintain snap
6. User releases Chat
7. 50ms later, clears `leaderWindow` (drag ended)

### Performance Considerations

- Position polling at 120fps is still lightweight for modern CPUs
- Only active when windows are snapped (not always running)
- Uses `setPosition(targetX, targetY, false)` to skip animation for faster sync
- Leader tracking prevents oscillation and "snap into place" effect
- Minimal overhead: just a few integer comparisons and one `setPosition` call per poll

## Future Enhancements (Not Yet Implemented)

1. **Persist Snap State** - Remember arrangement across app restarts
2. **Vertical Stacking** - Support snapping one window above/below the other
3. **Customizable Colors** - Allow users to change snap guide color
4. **Snap Magnetism** - Slight pull toward snap position when nearby

## Related Files

- [`desktop-app/main.js`](desktop-app/main.js) - Main SnapManager implementation
- [`desktop-app/preload.js`](desktop-app/preload.js) - IPC bridge with `onSnapGuideChanged`
- [`desktop-app/server/styles/shared-styles.css`](desktop-app/server/styles/shared-styles.css) - Snap guide CSS
- [`desktop-app/server/buddy-list.html`](desktop-app/server/buddy-list.html) - Buddy List snap guide UI
- [`desktop-app/server/chat-popout.html`](desktop-app/server/chat-popout.html) - Chat Popout snap guide UI
