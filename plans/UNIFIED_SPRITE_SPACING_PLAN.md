# Unified Sprite Spacing System - Implementation Plan

**Author:** Development Team  
**Created:** 2026-02-06  
**Status:** Draft - Awaiting Approval  
**Version:** 1.0

---

## Executive Summary

This plan outlines the implementation of a unified sprite spacing system that:

1. Uses the **same spacing algorithm** for both inner and outer rings
2. Allows **user-controlled positioning** via chat commands
3. Implements **collision detection and nudging** to prevent overlap
4. **Dynamically adjusts minimum gap** based on sprite count
5. Ensures **uniform visual appearance** when rings are full

---

## Table of Contents

1. [Vision & Goals](#vision--goals)
2. [Current State Analysis](#current-state-analysis)
3. [Proposed Architecture](#proposed-architecture)
   - [System Diagram](#system-diagram)
   - [Movement States Integration](#movement-states-integration)
4. [Algorithm Design](#algorithm-design)
5. [Collision System](#collision-system)
6. [Implementation Steps](#implementation-steps)
7. [Risk Assessment](#risk-assessment)
8. [Backward Compatibility](#backward-compatibility)
9. [Testing Strategy](#testing-strategy)

---

## Vision & Goals

### Primary Goals

| Goal | Description | Priority |
|------|-------------|----------|
| **Unified Logic** | Single spacing algorithm for both rings | P0 |
| **User Control** | Users can choose positions via chat commands | P0 |
| **Collision Avoidance** | Automatic nudging when sprites overlap | P0 |
| **Equal Distribution** | Uniform spacing when ring is full | P1 |
| **Adaptive Sizing** | Minimum gap shrinks proportionally with density | P1 |
| **Visual Consistency** | Full rings look evenly spaced | P1 |

### Anti-Goals (What We're NOT Building)

- ❌ Hardcoded positions that ignore user preference
- ❌ Separate logic paths for different scenarios
- ❌ Fallback chains that create visual glitches
- ❌ Runtime fallbacks that show duplicate elements

---

## Current State Analysis

### Problems Identified

#### 1. Hardcoded Spacing Values

**Outer Ring** ([widget.html:3749](desktop-app/server/widget.html:3749)):
```javascript
const minSpacing = 25; // degrees between users - HARDCODED
```

**Inner Ring** ([widget.html:1534](desktop-app/server/widget.html:1534)):
```javascript
this.softCollisionMinGapDegrees = 15; // Degrees between sprites - HARDCODED
```

**Issue:** Both values are hardcoded without consideration for:
- Sprite size variations
- Ring radius differences
- Actual visual overlap

#### 2. Inconsistent Logic

| Ring | Algorithm | Fallback | Spacing |
|------|-----------|----------|---------|
| Inner | Even distribution OR grouping | Sequential placement | ~31px at 15° |
| Outer | Spiral search | Even distribution | ~87px at 25° |

#### 3. No Adaptive Behavior

When rings become crowded:
- Inner ring: Users stack sequentially (gaps form)
- Outer ring: Falls back to even distribution (ignores minimum spacing)

---

## Proposed Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Unified Spacing Manager                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    User Position Request                   │  │
│  │  - Chat command: !move <angle>                            │  │
│  │  - Arrow key movement (future)                            │  │
│  │  - !join (default position)                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Position Request Validator                     │  │
│  │  - Validate requested angle                               │  │
│  │  - Check if user can move to ring                          │  │
│  │  - Return best available position OR nudge recommendation │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Unified Spacing Calculator                    │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │  calculateEqualDistribution(users, ring, radius)     │   │  │
│  │  │  - Evenly space N users around available arc        │   │  │
│  │  │  - Returns positions for all users                   │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │  calculateAdaptiveGap(users, ring, spriteSize)      │   │  │
│  │  │  - Dynamically calculate minimum gap                 │   │  │
│  │  │  - gap = minSpriteGap + max(0, users - threshold)    │   │  │
│  │  └─────────────────────────────────────────────────────┘   │   │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │  resolveCollision(user, targetAngle, existingUsers) │   │  │
│  │  │  - Find nearest non-colliding position               │   │  │
│  │  │  - Return nudged angle with minimal displacement     │   │  │
│  │  └─────────────────────────────────────────────────────┘   │   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Ring Manager                             │  │
│  │                                                              │  │
│  │  ┌─────────────────┐    ┌─────────────────┐                │  │
│  │  │  Inner Ring     │    │  Outer Ring     │                │  │
│  │  │  - Radius: 120  │    │  - Radius: 200  │                │  │
│  │  │  - Arc: 360°   │    │  - Arc: 160°    │                │  │
│  │  │  - Limit: 20   │    │  - Limit: 10    │                │  │
│  │  └─────────────────┘    └─────────────────┘                │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │  transitionUserToRing(user, ring, newPosition)        │   │  │
│  │  │  - Animate user to new ring                           │   │  │
│  │  │  - Recalculate all positions if needed                │   │  │
│  │  │  - Handle collision during transition                 │   │  │
│  │  └─────────────────────────────────────────────────────┘   │   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Movement States Integration

The unified spacing system must work harmoniously with the existing movement states: **STILL**, **ROAM**, **WANDER**, **LURK**, and **AFK**.

#### Movement State Definitions

| State | Behavior | Spacing Impact |
|-------|----------|----------------|
| **STILL** | No automatic movement | Respected by spacing system - never auto-repositioned |
| **ROAM** | Normal wandering (random direction changes) | Collision avoidance applies |
| **WANDER** | Active wandering (10-35° steps) | Larger personal space - more aggressive collision avoidance |
| **WANDER** | Very active (10-35° steps, 100% move chance) | Doubled frequency for lively behavior |
| **LURK** | Outer ring only, 0.5x speed | Respects outer ring arc limits (190°-350°) |
| **AFK** | MUST be STILL, outer ring | Always respects user choice - never auto-repositions |

#### Key Integration Rules

1. **STILL users are never auto-rebalanced**
   - If a user is in STILL mode, the equal distribution system SKIPS them
   - Only applies to non-STILL users when ring is crowded
   - Still users CAN be nudged by collision avoidance (collision takes priority)

2. **Equal distribution respects user choice**
   ```javascript
   // In calculateEqualDistribution:
   const nonStillUsers = users.filter(u => !u.still);
   // Only rebalance non-STILL users
   ```

3. **Collision avoidance works regardless of movement state**
   - Even STILL users get nudged if they're overlapping
   - This prevents visual glitches

4. **AFK → Outer Ring → STILL**
   - When user becomes AFK, they're moved to outer ring
   - AFK state enforces STILL mode automatically
   - Position calculated using unified spacing (160° arc)

5. **LURK → Outer Ring → Can Wander**
   - LURK users can roam on outer ring (reduced distance)
   - Movement: 0.5x speed compared to normal roaming
   - Collision avoidance still applies

#### Movement State Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Movement States & Spacing                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │    STILL     │    │     ROAM     │    │    WANDER    │   │
│  ├──────────────┤    ├──────────────┤    ├──────────────┤   │
│  │ • No auto    │    │ • Normal     │    │ • Active     │   │
│  │   movement   │    │   wandering  │    │   movement   │   │
│  │ • Respected  │    │ • Collision │    │ • More space │   │
│  │   by spacer  │    │   applies    │    │   needed     │   │
│  │ • Can be     │    │ • Auto-      │    │ • Auto-      │   │
│  │   nudged     │    │   rebalance  │    │   rebalance  │   │
│  │              │    │   allowed    │    │   allowed    │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐                       │
│  │    LURK      │    │     AFK      │                       │
│  ├──────────────┤    ├──────────────┤                       │
│  │ • Outer ring │    │ • Outer ring │                       │
│  │ • Can wander │    │ • MUST be    │                       │
│  │ • 0.5x speed │    │   STILL      │                       │
│  │ • Collision  │    │ • Respected  │                       │
│  │   applies    │    │   by spacer  │                       │
│  │ • Arc: 190-  │    │ • Arc: 190-  │                       │
│  │   350°       │    │   350°       │                       │
│  └──────────────┘    └──────────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Implementation Considerations

1. **When user becomes STILL via command**:
   - Stop any active movement animation
   - Mark user as `still = true`
   - Skip in equal distribution calculations
   - Still eligible for collision nudging

2. **When AFK user returns (becomes active)**:
   - Remove from outer ring, move to inner ring
   - Reset movement state to ROAM (default)
   - Trigger position recalculation

3. **When ring is crowded with STILL users**:
   - Count non-STILL users for density calculation
   - Only compress gaps for non-STILL users
   - STILL users keep their minimum gaps

---

## Algorithm Design

### Core Formula: Adaptive Minimum Gap

```
minimumGap(angle) = 
    // Base gap based on sprite size
    (spriteSize / ringRadius) × (180 / π) × safetyFactor
    
    // Adaptive reduction when crowded (NOT equal distribution)
    + max(0, (userCount - comfortableThreshold) × compressionFactor)
```

### Behavior Rules

| Scenario | Behavior | User Control |
|----------|----------|--------------|
| **Few users** (below threshold) | Enforce **minimum gap only** | Users can choose any position |
| **Crowded** (above threshold) | **Equal distribution** kicks in | System auto-balances |
| **Ring full** | Compress gaps proportionally | All users spaced evenly |

### Key Design Principle

> **"User choice first, equal distribution as a last resort."**

When there are few users around the circle:
1. Each new user gets their **requested position** (via chat command)
2. System only **nudges** if they violate minimum gap
3. **No forced equal spacing** - users choose where they want to be

When the ring becomes crowded (above `comfortableThreshold`):
1. Minimum gap becomes impossible to maintain at desired size
2. System **compresses gaps proportionally** for all users
3. Results in **equal distribution** automatically

### Variables

| Variable | Description | Default | Type |
|----------|-------------|---------|------|
| `spriteSize` | User's sprite size in pixels | 40px | config |
| `ringRadius` | Distance from center to sprite center | varies | ring |
| `safetyFactor` | Multiplier for extra spacing | 1.5 | config |
| `comfortableThreshold` | Users before compression starts | 10 | config |
| `compressionFactor` | Degrees removed per extra user | 2° | config |
| `maxUsers` | Maximum users per ring | 20 (inner), 10 (outer) | config |

### Example Calculations

#### Inner Ring (Radius: 120px, Sprite Size: 40px)

| Users | Mode | Min Gap | What Happens |
|-------|------|---------|--------------|
| 3 | **User Choice** | 20° | Each user picks where they want. System only nudges if they overlap. |
| 5 | **User Choice** | 20° | Each user picks where they want. System only nudges if they overlap. |
| 10 | **User Choice** | 20° | Each user picks where they want. System only nudges if they overlap. |
| 15 | **Transition** | 10° | Compression starts. Gap shrinks proportionally. |
| 20 | **Equal Distribution** | 5° | All users auto-balanced around circle. |

#### Outer Ring (Radius: 200px, Sprite Size: 40px)

| Users | Mode | Min Gap | What Happens |
|-------|------|---------|--------------|
| 3 | **User Choice** | 12° | AFK/LURK users pick positions in 190°-350° arc. |
| 6 | **User Choice** | 12° | Each user picks where they want. |
| 8 | **User Choice** | 12° | Each user picks where they want. |
| 10 | **Transition** | 8° | Compression starts. |

#### Visual Example: 4 Users on Inner Ring

```
Current Behavior (PROBLEM):
- User A joins at 0° → placed at 72° (forced equal!)
- User B joins at 90° → placed at 144° (forced equal!)
- User wanted 90° but got 144° ← WRONG

New Behavior (CORRECT):
- User A requests 0° → placed at 0° ✓
- User B requests 90° → placed at 90° ✓
- User C requests 270° → placed at 270° ✓
- User D requests 45° → placed at 45° ✓
- Only nudge if someone tries 5° (too close to 0°)
```

### Unified Position Calculator

```javascript
class UnifiedSpacingCalculator {
    constructor(settings) {
        this.settings = settings;
    }
    
    /**
     * Calculate minimum gap based on sprite size and ring radius
     * @param {number} spriteSize - Size of sprite in pixels
     * @param {number} ringRadius - Radius of the ring
     * @param {number} userCount - Number of users on ring
     * @param {Object} options - Configuration options
     * @returns {number} Minimum gap in degrees
     */
    calculateMinGap(spriteSize, ringRadius, userCount, options = {}) {
        const {
            safetyFactor = 1.5,
            comfortableThreshold = 10,
            compressionFactor = 2,
            maxCompression = 15 // Maximum degrees to compress
        } = options;
        
        // Base gap: sprite size converted to degrees with safety factor
        const baseGapDegrees = (spriteSize / ringRadius) * (180 / Math.PI) * safetyFactor;
        
        // Adaptive compression for crowded rings
        const excessUsers = Math.max(0, userCount - comfortableThreshold);
        const compression = Math.min(excessUsers * compressionFactor, maxCompression);
        
        return Math.max(0, baseGapDegrees - compression);
    }
    
    /**
     * Find best position for a user on a ring
     * @param {Object} user - User object (may be null for system-initiated balancing)
     * @param {Array} existingUsers - Array of existing users on ring
     * @param {Object} ringConfig - Ring configuration
     * @returns {Object} Position result with angle and metadata
     */
    findBestPosition(user, existingUsers, ringConfig) {
        const { radius, arcStart, arcEnd, maxUsers } = ringConfig;
        const userCount = existingUsers.length;
        
        // Check if ring is at capacity
        if (userCount >= maxUsers) {
            return {
                success: false,
                error: 'RING_FULL',
                message: `Ring is at maximum capacity (${maxUsers} users)`
            };
        }
        
        // User has a specific position request
        if (user && user.requestedAngle !== undefined) {
            const collision = this.checkCollision(
                user.requestedAngle,
                existingUsers,
                radius,
                this.calculateMinGap(user.spriteSize, radius, userCount)
            );
            
            if (!collision) {
                return {
                    success: true,
                    angle: user.requestedAngle,
                    nudged: false,
                    message: 'Position available as requested'
                };
            }
            
            // Find nearest non-colliding position (small nudge)
            return this.findNearestAvailable(
                user.requestedAngle,
                existingUsers,
                ringConfig
            );
        }
        
        // No specific request - use equal distribution
        return this.findEqualDistributionPosition(user, existingUsers, ringConfig);
    }
    
    /**
     * Find position that maintains equal distribution
     * ONLY called when user has no preference OR for system rebalancing
     */
    findEqualDistributionPosition(user, existingUsers, ringConfig) {
        const { radius, arcStart, arcEnd, maxUsers } = ringConfig;
        const arcSize = arcEnd - arcStart;
        const userCount = existingUsers.length;
        
        // Calculate ideal gap for N+1 users
        const idealGap = arcSize / (userCount + 1);
        
        // Find position that maximizes minimum distance to all neighbors
        let bestAngle = arcStart + idealGap;
        let bestMinDistance = 0;
        
        // Try all possible positions at idealGap intervals
        for (let angle = arcStart + idealGap; angle <= arcEnd; angle += idealGap) {
            const minDistance = this.getMinDistanceToNeighbors(angle, existingUsers, radius);
            
            if (minDistance > bestMinDistance) {
                bestMinDistance = minDistance;
                bestAngle = angle;
            }
        }
        
        return {
            success: true,
            angle: bestAngle,
            nudged: false,
            message: 'Position calculated for equal distribution'
        };
    }
    
    /**
     * Find nearest available position to a target angle
     */
    findNearestAvailable(targetAngle, existingUsers, ringConfig) {
        const { radius, arcStart, arcEnd } = ringConfig;
        const minGap = this.calculateMinGap(40, radius, existingUsers.length); // Use default sprite size
        
        // Search outward from target in both directions
        let offset = 0;
        const maxSearch = 180; // Don't search more than half circle
        
        while (offset < maxSearch) {
            // Try positive direction
            const positiveAngle = (targetAngle + offset) % 360;
            if (this.isPositionAvailable(positiveAngle, existingUsers, radius, minGap, arcStart, arcEnd)) {
                return {
                    success: true,
                    angle: positiveAngle,
                    nudged: true,
                    message: `Nudged ${offset.toFixed(1)}° clockwise`,
                    nudgeDistance: offset
                };
            }
            
            // Try negative direction
            const negativeAngle = (targetAngle - offset + 360) % 360;
            if (this.isPositionAvailable(negativeAngle, existingUsers, radius, minGap, arcStart, arcEnd)) {
                return {
                    success: true,
                    angle: negativeAngle,
                    nudged: true,
                    message: `Nudged ${offset.toFixed(1)}° counter-clockwise`,
                    nudgeDistance: offset
                };
            }
            
            offset += minGap / 4; // Search in increments
        }
        
        // No position found within reasonable range
        return this.findEqualDistributionPosition(null, existingUsers, ringConfig);
    }
    
    /**
     * Check if a position collides with any existing user
     */
    checkCollision(angle, existingUsers, radius, minGap) {
        for (const user of existingUsers) {
            const distance = this.angularDistance(angle, user.angle);
            if (distance < minGap) {
                return {
                    collided: true,
                    userId: user.id,
                    distance: distance
                };
            }
        }
        return { collided: false };
    }
    
    /**
     * Check if position is available within arc bounds
     */
    isPositionAvailable(angle, existingUsers, radius, minGap, arcStart, arcEnd) {
        // Check arc bounds
        if (angle < arcStart || angle > arcEnd) {
            return false;
        }
        
        // Check collisions
        const collision = this.checkCollision(angle, existingUsers, radius, minGap);
        return !collision.collided;
    }
    
    /**
     * Calculate minimum angular distance between two angles
     */
    angularDistance(angle1, angle2) {
        const diff = Math.abs(angle1 - angle2);
        return Math.min(diff, 360 - diff);
    }
    
    /**
     * Get minimum distance to neighboring users
     */
    getMinDistanceToNeighbors(angle, existingUsers, radius) {
        if (existingUsers.length === 0) {
            return Infinity;
        }
        
        let minDistance = Infinity;
        for (const user of existingUsers) {
            const distance = this.angularDistance(angle, user.angle);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }
        return minDistance;
    }
}
```

---

## Collision System

### Design Principles

1. **Proactive Detection** - Check for collisions before finalizing positions
2. **Minimal Nudging** - Move sprites the smallest distance necessary
3. **Directional Choice** - Prefer direction with more available space
4. **Visual Feedback** - Show users when they've been nudged (optional)

### Collision Resolution Algorithm

```
┌─────────────────────────────────────────────────────────────┐
│                  Collision Resolution Flow                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User requests position X                                  │
│                     │                                         │
│                     ▼                                         │
│  2. Check collision with all existing users                  │
│     - Calculate angular distance to each user               │
│     - Compare with minimum required gap                     │
│                     │                                         │
│                     ├── No Collision ──► Grant position       │
│                     │                                         │
│                     └── Collision ──► Continue               │
│                                                              │
│  3. Find nearest available position                          │
│     - Search outward from target in increments              │
│     - Check both clockwise and counter-clockwise            │
│     - Return first valid position found                     │
│                     │                                         │
│                     ▼                                         │
│  4. Calculate nudge amount                                   │
│     - Store original and final positions                   │
│     - Calculate displacement for animation                  │
│                     │                                         │
│                     ▼                                         │
│  5. Animate user to new position                            │
│     - Smooth transition to nudged position                  │
│     - Notify user of nudge (optional)                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Real-Time Collision Handling

```javascript
class CollisionManager {
    constructor(spacingCalculator) {
        this.calculator = spacingCalculator;
        this.collisionThreshold = 0.8; // Alert at 80% of min gap
    }
    
    /**
     * Monitor for collisions during user movement
     * Called periodically or on position updates
     */
    monitorCollisions(users, ringConfig) {
        const collisions = [];
        
        for (let i = 0; i < users.length; i++) {
            for (let j = i + 1; j < users.length; j++) {
                const userA = users[i];
                const userB = users[j];
                
                const distance = this.calculator.angularDistance(
                    userA.angle,
                    userB.angle
                );
                
                const minGap = this.calculator.calculateMinGap(
                    userA.spriteSize,
                    ringConfig.radius,
                    users.length
                );
                
                if (distance < minGap * this.collisionThreshold) {
                    collisions.push({
                        userA: userA.id,
                        userB: userB.id,
                        distance: distance,
                        severity: distance < minGap ? 'collision' : 'warning'
                    });
                }
            }
        }
        
        return collisions;
    }
    
    /**
     * Resolve all detected collisions
     * Returns list of position adjustments
     */
    resolveCollisions(users, ringConfig) {
        const adjustments = [];
        const minGap = this.calculator.calculateMinGap(
            40, // Use average sprite size
            ringConfig.radius,
            users.length
        );
        
        // Sort users by angle for sequential resolution
        const sortedUsers = [...users].sort((a, b) => a.angle - b.angle);
        
        // Resolve from center outward
        for (const user of sortedUsers) {
            const adjustment = this.resolveUserCollision(
                user,
                sortedUsers,
                minGap,
                ringConfig
            );
            
            if (adjustment) {
                adjustments.push(adjustment);
                user.angle = adjustment.newAngle;
            }
        }
        
        return adjustments;
    }
    
    /**
     * Resolve collision for single user
     */
    resolveUserCollision(user, allUsers, minGap, ringConfig) {
        const neighbors = allUsers.filter(u => u.id !== user.id);
        
        // Find closest neighbor
        let closestNeighbor = null;
        let closestDistance = Infinity;
        
        for (const neighbor of neighbors) {
            const distance = this.calculator.angularDistance(
                user.angle,
                neighbor.angle
            );
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestNeighbor = neighbor;
            }
        }
        
        // No collision if no neighbors or sufficient distance
        if (!closestNeighbor || closestDistance >= minGap) {
            return null;
        }
        
        // Determine push direction (away from closest neighbor)
        let newAngle;
        const direction = this.getPushDirection(user, closestNeighbor, ringConfig);
        
        // Push user in chosen direction
        newAngle = user.angle + (direction * (minGap - closestDistance) * 1.1);
        newAngle = this.normalizeAngle(newAngle, ringConfig);
        
        // Verify new position is valid
        if (!this.calculator.isPositionAvailable(
            newAngle,
            neighbors,
            ringConfig.radius,
            minGap,
            ringConfig.arcStart,
            ringConfig.arcEnd
        )) {
            // Try opposite direction
            direction = -direction;
            newAngle = user.angle + (direction * (minGap - closestDistance) * 1.1);
        }
        
        return {
            userId: user.id,
            originalAngle: user.angle,
            newAngle: newAngle,
            reason: 'collision_resolution'
        };
    }
    
    /**
     * Determine which direction to push a user
     */
    getPushDirection(user, neighbor, ringConfig) {
        // Calculate angular difference
        let diff = neighbor.angle - user.angle;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        // Check space available in each direction
        const clockwiseSpace = this.calculator.angularDistance(
            user.angle,
            ringConfig.arcEnd
        );
        
        const counterClockwiseSpace = this.calculator.angularDistance(
            ringConfig.arcStart,
            user.angle
        );
        
        // Push toward more available space
        return clockwiseSpace > counterClockwiseSpace ? 1 : -1;
    }
    
    /**
     * Normalize angle to 0-360 range
     */
    normalizeAngle(angle, ringConfig) {
        let normalized = angle % 360;
        if (normalized < 0) normalized += 360;
        
        // Clamp to arc bounds with small margin
        const margin = 2; // degrees
        return Math.max(ringConfig.arcStart + margin,
               Math.min(ringConfig.arcEnd - margin, normalized));
    }
}
```

---

## Implementation Steps

### Phase 1: Core Infrastructure

| Step | Description | File | Lines Est. |
|------|-------------|------|------------|
| 1.1 | Create `UnifiedSpacingCalculator` class | `widget.html` | 100 |
| 1.2 | Create `CollisionManager` class | `widget.html` | 80 |
| 1.3 | Add ring configuration constants | `widget.html` | 30 |
| 1.4 | Implement min gap calculation | `widget.html` | 40 |

### Phase 2: Position Calculation

| Step | Description | File | Lines Est. |
|------|-------------|------|------------|
| 2.1 | Implement `findBestPosition()` | `widget.html` | 60 |
| 2.2 | Implement `findEqualDistributionPosition()` | `widget.html` | 40 |
| 2.3 | Implement `findNearestAvailable()` | `widget.html` | 50 |
| 2.4 | Update `calculateNextAngle()` to use unified logic | `widget.html` | 30 |

### Phase 3: Collision Handling

| Step | Description | File | Lines Est. |
|------|-------------|------|------------|
| 3.1 | Implement collision detection | `widget.html` | 40 |
| 3.2 | Implement nudge animation | `widget.html` | 50 |
| 3.3 | Add real-time collision monitoring | `widget.html` | 30 |
| 3.4 | Implement collision resolution | `widget.html` | 60 |

### Phase 4: Integration

| Step | Description | File | Lines Est. |
|------|-------------|------|------------|
| 4.1 | Update `addUser()` to use new system | `widget.html` | 40 |
| 4.2 | Update `moveUserToRing()` for both rings | `widget.html` | 50 |
| 4.3 | Update `positionUserElement()` | `widget.html` | 30 |
| 4.4 | Add chat command handlers | `widget.html` | 40 |

### Phase 5: Testing & Polish

| Step | Description | File | Lines Est. |
|------|-------------|------|------------|
| 5.1 | Add unit tests for spacing logic | `widget.test.js` | 100 |
| 5.2 | Add integration tests | `widget.test.js` | 80 |
| 5.3 | Test edge cases | - | 20 |
| 5.4 | Update documentation | `DEVELOPER_GUIDE.md` | 50 |

---

## Risk Assessment

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| **Breaking user expectations** | High | Medium | Add feature flag, gradual rollout |
| **Performance degradation** | Medium | Low | Limit collision checks, use requestAnimationFrame |
| **Animation conflicts** | Medium | Medium | Add movement locks, queue transitions |
| **Edge case bugs** | Medium | Medium | Comprehensive testing, defensive coding |
| **Integration issues** | Low | Low | Phased rollout, feature flags |

### Rollback Strategy

1. Store old logic in comments for 30 days
2. Add `useLegacySpacing` config option
3. Monitor error rates for 7 days post-launch

---

## Backward Compatibility

### Breaking Changes

| Change | Impact | Migration Path |
|--------|--------|----------------|
| Spacing algorithm | Users may notice different positions | Allow legacy mode for 30 days |
| Chat commands | `!move <angle>` format unchanged | No action needed |
| Ring transitions | Same behavior, smoother animation | No action needed |
| User limits | May need adjustment per ring | New defaults documented |

### Compatibility Mode

```javascript
// In settings, allow opt-in to legacy behavior
const settings = {
    useLegacySpacing: false, // Default to new system
    // ... other settings
};
```

---

## Testing Strategy

### Unit Tests

```javascript
describe('UnifiedSpacingCalculator', () => {
    describe('calculateMinGap', () => {
        it('returns base gap for comfortable user count', () => {
            const calc = new UnifiedSpacingCalculator({});
            const gap = calc.calculateMinGap(40, 120, 5);
            expect(gap).toBeCloseTo(20, 1); // ~20° for 40px sprite at 120px radius
        });
        
        it('compresses gap when crowded', () => {
            const calc = new UnifiedSpacingCalculator({});
            const gap = calc.calculateMinGap(40, 120, 20);
            expect(gap).toBeLessThan(10);
        });
        
        it('never returns negative gap', () => {
            const calc = new UnifiedSpacingCalculator({});
            const gap = calc.calculateMinGap(100, 100, 50);
            expect(gap).toBeGreaterThanOrEqual(0);
        });
    });
    
    describe('findBestPosition', () => {
        it('returns requested position when available', () => {
            const calc = new UnifiedSpacingCalculator({});
            const result = calc.findBestPosition(
                { requestedAngle: 90 },
                [{ angle: 180 }],
                { radius: 120, arcStart: 0, arcEnd: 360, maxUsers: 20 }
            );
            expect(result.success).toBe(true);
            expect(result.angle).toBe(90);
        });
        
        it('nudges when position is occupied', () => {
            const calc = new UnifiedSpacingCalculator({});
            const result = calc.findBestPosition(
                { requestedAngle: 90 },
                [{ angle: 95 }],
                { radius: 120, arcStart: 0, arcEnd: 360, maxUsers: 20 }
            );
            expect(result.success).toBe(true);
            expect(result.nudged).toBe(true);
        });
        
        it('returns error when ring is full', () => {
            const calc = new UnifiedSpacingCalculator({});
            const result = calc.findBestPosition(
                {},
                Array(20).fill({ angle: 0 }),
                { radius: 120, arcStart: 0, arcEnd: 360, maxUsers: 20 }
            );
            expect(result.success).toBe(false);
            expect(result.error).toBe('RING_FULL');
        });
    });
});
```

### Integration Tests

```javascript
describe('Collision System', () => {
    it('resolves collisions without creating new ones', () => {
        // Setup crowded ring with collisions
        // Run collision resolution
        // Verify no users are within min gap
    });
    
    it('minimizes total displacement', () => {
        // Setup scenario with multiple valid solutions
        // Verify algorithm chooses minimum displacement
    });
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `desktop-app/server/widget.html` | Main implementation (all phases) |
| `__tests__/widget.test.js` | Unit and integration tests |
| `DEVELOPER_GUIDE.md` | Update with new patterns |
| `KNOWN_ISSUES.md` | Remove resolved spacing issues |

---

## Approval Required

Before proceeding to implementation, please review:

- [ ] Algorithm design meets requirements
- [ ] Risk assessment is acceptable
- [ ] Backward compatibility strategy is approved
- [ ] Testing approach is sufficient

---

*This document follows the [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) principles of single source of truth, explicit over implicit, and fail loudly not silently.*
