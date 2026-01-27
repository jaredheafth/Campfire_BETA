# Command System & Dashboard UI Refactor Plan

## Executive Summary

This document outlines a comprehensive refactor of the Campfire Widget command system and Dashboard UI to create a clean, maintainable, and extensible architecture.

---

## Current State Analysis

### The Three Chat Destinations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MESSAGE ROUTING ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. INTERNAL CHAT (Dashboard Chat Tab)                                       │
│     ├── Purpose: Source of truth, debugging, complete history               │
│     ├── Shows: EVERYTHING (commands, responses, user messages, bot msgs)    │
│     └── Control: None - always shows all                                    │
│                                                                              │
│  2. POPOUT CHAT (User-facing, for streamer)                                 │
│     ├── Purpose: Clean chat display for stream overlay or monitoring        │
│     ├── Shows: User messages, bot responses (configurable)                  │
│     └── Control: Per-command toggles for what appears                       │
│                                                                              │
│  3. TWITCH CHAT (External, twitch.tv)                                       │
│     ├── Purpose: The actual Twitch chat                                     │
│     ├── Shows: Whatever we send via IRC                                     │
│     └── Control: Per-command toggles, rate limits apply                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Current Problems

1. **SILENT Toggle Misunderstanding**: Currently implemented as "don't send bot response to Twitch" but should mean "hide the user's command text from user-facing chats"

2. **Scattered Command Configuration**: 
   - JOIN tab defines: join commands, afk commands, lurk commands
   - COMMANDS tab defines: all other commands + duplicates join/afk/lurk
   - Settings file stores both, leading to sync issues

3. **Multiple Sources of Truth**:
   - `botMessagesCache` in main.js
   - `settings.commands`, `settings.afkCommands`, `settings.lurkCommands`
   - Dashboard localStorage
   - bot-messages.json file

4. **Missing AUTO STATE Messages**: No UI for configuring messages when automatic state transitions happen (ACTIVE → SLEEPY → AFK)

---

## Proposed Architecture

### Message Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MESSAGE TYPE TAXONOMY                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER MESSAGES                                                               │
│  ├── Regular chat messages (always show everywhere)                         │
│  └── Command invocations (e.g., "!cw", "!spin")                            │
│      └── SILENT toggle: Hide from Popout/Twitch, always show in Internal   │
│                                                                              │
│  BOT RESPONSES                                                               │
│  ├── Command responses (e.g., "heafth spins!")                             │
│  │   ├── Twitch toggle: Send to Twitch chat                                │
│  │   └── Popout toggle: Send to Popout chat                                │
│  │                                                                          │
│  └── Auto-state announcements (e.g., "heafth went AFK 💤")                 │
│      ├── Triggered by: Timer-based state transitions                        │
│      ├── Twitch toggle: Send to Twitch chat                                │
│      └── Popout toggle: Send to Popout chat                                │
│                                                                              │
│  SYSTEM MESSAGES                                                             │
│  └── Internal only (errors, debug info)                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Command Configuration Schema

```javascript
// Single source of truth for all commands
const CommandConfig = {
  // Unique identifier
  id: 'spin',
  
  // Display name for UI
  name: 'Spin Command',
  
  // Category for grouping
  category: 'ANIMATION', // STATE | MOVEMENT | APPEARANCE | ANIMATION | CUSTOM
  
  // Trigger words (multiple aliases supported)
  triggers: ['!spin'],
  
  // Whether command is enabled
  enabled: true,
  
  // Message configuration
  message: {
    template: '{username} spins!',
    
    // Where to send the BOT RESPONSE
    destinations: {
      twitch: true,    // Send response to Twitch chat
      popout: true,    // Send response to Popout chat
      internal: true   // Always true, not configurable
    }
  },
  
  // Command text visibility (SILENT toggle)
  hideCommandText: false, // When true, "!spin" is hidden from Popout/Twitch
  
  // Who can use this command
  permissions: {
    requiresJoin: true,     // Must be in campfire
    allowNonCampers: false  // Override: allow non-joined users
  },
  
  // Action handler (for commands that DO something)
  action: 'handleSpinCommand', // null for message-only commands
  
  // Flags
  isDefault: true,  // Built-in command (can't delete)
  isCustom: false   // User-created command
};
```

### Auto-State Configuration Schema

```javascript
// Configuration for automatic state transition messages
const AutoStateConfig = {
  // State transition identifier
  id: 'active-to-sleepy',
  
  // Display name
  name: 'Sleepy Transition',
  
  // Trigger condition
  trigger: {
    fromState: 'ACTIVE',
    toState: 'SLEEPY',
    type: 'auto' // 'auto' = timer-based, 'manual' = command-based
  },
  
  // Whether this announcement is enabled
  enabled: true,
  
  // Message configuration
  message: {
    template: '{username} is getting sleepy... 😴',
    
    destinations: {
      twitch: true,
      popout: true,
      internal: true // Always true
    }
  }
};
```

---

## Dashboard UI Consolidation

### Current Tab Structure (Problematic)

```
Dashboard
├── JOIN Tab
│   ├── Join Method (command/emote/cheer)
│   ├── Join Commands (!join, !camp, etc.)
│   ├── AFK Commands (!afk, !away)        ← DUPLICATE
│   ├── Lurk Commands (!lurk)             ← DUPLICATE
│   └── Leave Commands (!leave, !exit)    ← DUPLICATE
│
├── COMMANDS Tab
│   ├── Bot Commands Sub-tab
│   │   ├── STATE Commands (join, leave, afk, lurk)  ← DUPLICATE
│   │   ├── DEFAULT Commands (help, spin, dance...)
│   │   └── CUSTOM Commands
│   ├── Movement/Appearance Sub-tab
│   └── Auto States Sub-tab (empty)
│
└── Other tabs...
```

### Proposed Tab Structure (Clean)

```
Dashboard
├── JOIN Tab (Simplified)
│   ├── Join Method (command/emote/cheer)
│   ├── Join Trigger Configuration
│   │   └── (command text, emote name, or cheer amount)
│   └── Auto-Join Settings
│       └── (streamer auto-join, bot auto-join)
│
├── COMMANDS Tab (Unified)
│   ├── STATE Commands Section
│   │   ├── Join (!join, !camp...)
│   │   ├── Leave (!leave, !exit)
│   │   ├── AFK (!afk, !away)
│   │   └── Lurk (!lurk)
│   │
│   ├── MOVEMENT Commands Section
│   │   ├── Clockwise (!cw)
│   │   ├── Counter-clockwise (!ccw)
│   │   ├── Still (!still)
│   │   ├── Roam (!roam)
│   │   └── Wander (!wander)
│   │
│   ├── APPEARANCE Commands Section
│   │   ├── Change Sprite (!sprite, !changesprite)
│   │   ├── Change Color (!color, !changecolor)
│   │   ├── Next/Back (!next, !back)
│   │   ├── Random (!random)
│   │   └── Reset (!reset)
│   │
│   ├── ANIMATION Commands Section
│   │   ├── Spin (!spin)
│   │   ├── Dance (!dance)
│   │   └── Sparkle (!sparkle)
│   │
│   ├── INFO Commands Section
│   │   └── Help (!help)
│   │
│   └── CUSTOM Commands Section
│       └── [User-defined commands]
│
├── AUTO STATES Tab (New)
│   ├── State Timers
│   │   ├── Time to SLEEPY (minutes)
│   │   ├── Time to AFK (minutes)
│   │   └── Auto-leave time (minutes, 0 = disabled)
│   │
│   └── State Transition Messages
│       ├── ACTIVE → SLEEPY
│       ├── SLEEPY → AFK
│       ├── AFK → Auto-Leave
│       └── Return from AFK/LURK
│
└── Other tabs...
```

---

## Per-Command UI Controls

Each command card should have:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 STATE COMMAND                                                    [ON/OFF]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Command Name: Join Command                                                  │
│                                                                              │
│  Triggers: !join, !camp, heafthcamp                          [Edit Triggers]│
│                                                                              │
│  Response: {username} joined the campfire!                   [Edit Response]│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ COMMAND TEXT VISIBILITY                                                 ││
│  │ ┌──────────────────┐                                                    ││
│  │ │ Hide from Chat   │  When ON, "!join" won't appear in Popout/Twitch   ││
│  │ │      [OFF]       │  (Always visible in Internal Chat)                 ││
│  │ └──────────────────┘                                                    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ BOT RESPONSE DESTINATIONS                                               ││
│  │ ┌──────────────────┐ ┌──────────────────┐                               ││
│  │ │ Twitch Chat      │ │ Popout Chat      │                               ││
│  │ │      [ON]        │ │      [ON]        │                               ││
│  │ └──────────────────┘ └──────────────────┘                               ││
│  │ (Internal Chat always receives all messages)                            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ PERMISSIONS                                                             ││
│  │ ┌──────────────────┐                                                    ││
│  │ │ Allow Non-Campers│  Let users who haven't joined use this command    ││
│  │ │      [OFF]       │                                                    ││
│  │ └──────────────────┘                                                    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Fix Current Bugs (DONE ✅)
- [x] Fix UserManager emit signatures
- [x] Fix joinCmd reference error
- [x] Add messages to movement commands

### Phase 2: Correct SILENT Toggle Behavior
- [ ] Rename `silent` to `hideCommandText` in schema
- [ ] Update message routing logic:
  - Internal Chat: Always show command text
  - Popout Chat: Hide if `hideCommandText` is true
  - Twitch Chat: Hide if `hideCommandText` is true
- [ ] Add separate `sendToTwitch` and `sendToPopout` toggles for bot responses

### Phase 3: Consolidate Command Configuration
- [ ] Create single `CommandManager` class
- [ ] Migrate all command definitions to unified schema
- [ ] Remove duplicate command definitions from JOIN tab
- [ ] Sync JOIN tab triggers with COMMANDS tab

### Phase 4: Implement Auto-State Messages
- [ ] Create `AutoStateManager` class
- [ ] Add UI for configuring state transition messages
- [ ] Hook into UserManager state change events
- [ ] Send messages based on configuration

### Phase 5: Dashboard UI Refactor
- [ ] Simplify JOIN tab (remove command definitions)
- [ ] Consolidate COMMANDS tab with all command types
- [ ] Create new AUTO STATES tab
- [ ] Update command card UI with new toggles

### Phase 6: Testing & Documentation
- [ ] Test all commands with new routing
- [ ] Update DEVELOPER_GUIDE.md
- [ ] Create user documentation for new UI

---

## Message Routing Logic (Pseudocode)

```javascript
async function routeMessage(messageType, content, config) {
  // 1. INTERNAL CHAT - Always receives everything
  sendToInternalChat(content);
  
  // 2. Handle based on message type
  if (messageType === 'USER_COMMAND') {
    // User typed a command like "!spin"
    if (!config.hideCommandText) {
      if (config.destinations.popout) sendToPopoutChat(content);
      // Note: User commands go to Twitch automatically via IRC
    }
  }
  
  else if (messageType === 'BOT_RESPONSE') {
    // Bot response like "heafth spins!"
    if (config.destinations.twitch) await sendToTwitchChat(content);
    if (config.destinations.popout) sendToPopoutChat(content);
  }
  
  else if (messageType === 'AUTO_STATE') {
    // Auto state message like "heafth went AFK"
    if (config.destinations.twitch) await sendToTwitchChat(content);
    if (config.destinations.popout) sendToPopoutChat(content);
  }
  
  else if (messageType === 'USER_MESSAGE') {
    // Regular chat message
    if (config.destinations.popout) sendToPopoutChat(content);
    // Already in Twitch via IRC
  }
}
```

---

## Files to Create/Modify

### New Files
- `desktop-app/src/main/commands/CommandManager.js` - Unified command management
- `desktop-app/src/main/commands/AutoStateManager.js` - Auto-state message handling
- `desktop-app/src/main/commands/MessageRouter.js` - Centralized message routing

### Modified Files
- `desktop-app/main.js` - Remove scattered command logic, use CommandManager
- `desktop-app/server/dashboard.html` - New UI structure
- `desktop-app/src/main/helpers/BotMessageHelper.js` - Update for new routing

---

## Questions for Clarification

1. **Command Text in Twitch**: When a user types `!cw` in Twitch chat, it appears in Twitch chat automatically (we can't prevent that). The SILENT/hideCommandText toggle would only affect whether we echo it to Popout Chat. Is this the expected behavior?

2. **Auto-State vs Manual State**: Should `!afk` (manual) and auto-AFK (timer) have different messages? Currently they share the same message template.

3. **Future Chat Integrations**: You mentioned "any other chats that may be integrated in the future" - should we design the routing system to be extensible for Discord, YouTube, etc.?

---

## Next Steps

1. Review and approve this plan
2. Prioritize phases based on urgency
3. Begin implementation in Code mode

