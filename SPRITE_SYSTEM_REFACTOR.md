# Sprite System Refactor Plan

## Overview

This document describes the architectural changes needed to create a stable, future-proof sprite system for the Campfire Widget. The current implementation has scattered fallback logic that causes bugs (like circles appearing behind sprites). This refactor consolidates sprite management into a single source of truth.

## Current Problems

### 1. Scattered Fallback Logic
- `createUserElement()` has fallback timeout that triggers `onerror()`
- `updateUserElement()` has similar fallback timeout
- `getUserSprite()` has inline fallback to SVG circles
- Multiple places create colored circle backgrounds

### 2. Multiple Code Paths
- `createUserElement()` - creates new user elements
- `updateUserElement()` - updates existing elements
- `simulateJoinForConnectedUsers()` - re-adds users on reconnect
- Various IPC handlers can modify sprites

### 3. No Single Source of Truth
Sprite state is stored in multiple places:
- `user.spritesByMode` - cached sprite per mode
- `user.selectedSprite` - user's chosen sprite
- `user.assignedSprite` - randomly assigned sprite
- `localStorage` - sprite collections
- DOM elements - actual displayed sprite

### 4. Race Conditions
- Async blob URL conversion can complete in unexpected order
- Image `onload` events can fire before or after timeouts
- Multiple updates to same user can overlap

## Proposed Architecture

### SpriteRegistry Class

```javascript
class SpriteRegistry {
    constructor() {
        // Sprite collections by mode
        this.collections = {
            'rpg-characters': [],
            'pixel-morphs': [],
            'circles': [],  // Generated SVG circles
            'custom': []
        };
        
        // User sprite assignments (userId -> spriteId)
        this.userAssignments = new Map();
        
        // Preloaded sprite data (spriteId -> base64/blob URL)
        this.loadedSprites = new Map();
    }
    
    // Load sprite collections from localStorage/files
    async loadCollections() { ... }
    
    // Get sprite for user (deterministic, no fallbacks)
    getSpriteForUser(userId, mode) {
        // 1. Check if user has assigned sprite for this mode
        const assignment = this.userAssignments.get(`${userId}:${mode}`);
        if (assignment) {
            return this.loadedSprites.get(assignment);
        }
        
        // 2. Assign random sprite from collection
        const collection = this.collections[mode];
        if (collection.length === 0) {
            // Mode has no sprites - use default circle
            return this.generateCircle(userId);
        }
        
        const spriteId = this.assignRandomSprite(userId, mode, collection);
        return this.loadedSprites.get(spriteId);
    }
    
    // Assign specific sprite to user
    assignSprite(userId, mode, spriteId) {
        this.userAssignments.set(`${userId}:${mode}`, spriteId);
        this.saveAssignments();
    }
    
    // Generate colored circle for user
    generateCircle(userId, color) {
        const svg = `<svg>...</svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }
}
```

### Simplified Element Creation

```javascript
createUserElement(user) {
    // 1. Get sprite SYNCHRONOUSLY (already loaded)
    const spriteData = this.spriteRegistry.getSpriteForUser(user.userId, this.settings.spriteMode);
    
    // 2. Create element with sprite
    const element = document.createElement('div');
    const img = document.createElement('img');
    img.src = spriteData;
    
    // 3. Handle load/error simply
    img.onload = () => this.showElement(element);
    img.onerror = () => {
        console.error(`Sprite failed to load for ${user.username}`);
        // Don't create fallback - just log error
        // User keeps their assigned sprite (even if broken)
    };
    
    // 4. Add to DOM
    element.appendChild(img);
    container.appendChild(element);
}
```

### Key Principles

1. **Synchronous Decision** - Sprite is decided BEFORE element creation
2. **No Runtime Fallbacks** - If sprite fails, log error but don't change
3. **Single Source of Truth** - SpriteRegistry owns all sprite state
4. **Preloaded Sprites** - All sprites loaded at startup, not on-demand
5. **Deterministic Assignment** - Same user always gets same sprite (unless changed)

## Implementation Steps

### Phase 1: Create SpriteRegistry (2 hours)
- [ ] Create `SpriteRegistry` class in `desktop-app/src/main/state/`
- [ ] Implement `loadCollections()` to load from localStorage
- [ ] Implement `getSpriteForUser()` with deterministic assignment
- [ ] Implement `assignSprite()` for manual assignment
- [ ] Add persistence for user assignments

### Phase 2: Integrate with Widget (2 hours)
- [ ] Initialize SpriteRegistry on widget load
- [ ] Replace `getUserSprite()` with `spriteRegistry.getSpriteForUser()`
- [ ] Remove all fallback timeout code (DONE - see below)
- [ ] Remove inline SVG circle generation
- [ ] Simplify `createUserElement()` and `updateUserElement()`

### Phase 3: Update Dashboard (1 hour)
- [ ] Add sprite management UI to dashboard
- [ ] Allow manual sprite assignment per user
- [ ] Show sprite preview in members list

### Phase 4: Testing & Cleanup (1 hour)
- [ ] Test all sprite modes
- [ ] Test mode switching
- [ ] Remove dead code
- [ ] Update documentation

## Already Completed

### Removed Fallback Timeouts (2026-01-26)
The 3-second fallback timeouts in `createUserElement()` and `updateUserElement()` have been removed. These were causing circles to appear behind successfully-loaded sprites because:

1. Sprite loads successfully via blob URL
2. 3-second timeout fires
3. Timeout checks `spriteImg.complete && spriteImg.naturalWidth > 0`
4. Check fails for blob URLs (timing issue)
5. Timeout calls `spriteImg.onerror()` manually
6. `onerror` creates fallback circle background
7. Now BOTH sprite (img) AND circle (background) are visible

**Fix**: Removed the timeout entirely. Sprites now either load (via `onload`) or fail (via `onerror`) - no artificial timeout that can misfire.

## File Locations

- **SpriteRegistry**: `desktop-app/src/main/state/SpriteRegistry.js` (to be created)
- **Widget**: `desktop-app/server/widget.html`
- **Dashboard**: `desktop-app/server/dashboard.html`
- **Sprite Collections**: `desktop-app/server/sprites/`

## Migration Notes

When implementing this refactor:

1. **Don't break existing functionality** - Keep current sprite loading working while building new system
2. **Feature flag** - Add a flag to switch between old and new systems
3. **Gradual rollout** - Test new system thoroughly before removing old code
4. **Preserve user assignments** - Migrate existing `user.spritesByMode` data to new format

## Questions for Product

1. Should users be able to choose their own sprite? (Currently random)
2. Should sprite assignments persist across sessions?
3. What happens when a sprite collection is deleted but users have assignments?
4. Should there be a "default" sprite for new users before random assignment?

---

*Document created: 2026-01-26*
*Last updated: 2026-01-26*
