# 🎯 Next Steps - Implementation Guide

## Overview

This guide outlines the 6 remaining high-priority items that should be completed before v0.0.22 release.

---

## Priority 1: Module Refactoring (MEDIUM)

### Why This Matters
- `widget.html` is 5700+ lines
- `dashboard.html` is 5000+ lines
- Hard to navigate, maintain, test
- Duplication of logic

### Implementation Plan

Extract into separate files:

```
desktop-app/server/
├── widget.html (simplified entry point)
├── dashboard.html (simplified entry point)
└── js/
    ├── widget-core.js (user management)
    ├── sprite-system.js (sprite loading & rendering)
    ├── settings.js (settings persistence)
    ├── chat-commands.js (command parsing)
    ├── ipc-bridge.js (Electron IPC communication)
    └── utils/
        ├── colors.js (color utilities)
        ├── math.js (circle math)
        ├── dom.js (DOM manipulation)
        └── storage.js (localStorage wrapper)
```

### Steps
1. Create `desktop-app/server/js/` directory
2. Extract user management → `widget-core.js` (500 lines)
3. Extract sprite functions → `sprite-system.js` (400 lines)
4. Extract settings → `settings.js` (300 lines)
5. Extract chat commands → `chat-commands.js` (200 lines)
6. Create utilities (colors, math, dom, storage)
7. Import modules in widget.html and dashboard.html
8. Test in app to ensure no regressions

### Files to Change
- `desktop-app/server/widget.html`
- `desktop-app/server/dashboard.html`
- Create 8 new JS files

### Testing
- Visual test in widget
- Settings test in dashboard
- Command test (type !join in chat)

---

## Priority 2: Event-Based Polling (MEDIUM)

### Why This Matters
- Using `setInterval` for periodic checks
- Wastes CPU cycles
- Adds latency

### Audit Steps
1. Search for `setInterval` in widget.html and main.js
2. Identify what's being polled (member list? settings? movements?)
3. Replace with IPC event emission

### Example Fix
```javascript
// Before: Polling every 2 seconds
setInterval(() => {
    fetchMemberList();
}, 2000);

// After: Event-driven
window.electronAPI.onMemberListChanged((members) => {
    updateMemberDisplay(members);
});
```

### Files to Check
- `desktop-app/main.js` (search for setInterval)
- `desktop-app/server/widget.html` (search for setInterval)
- `desktop-app/server/dashboard.html` (search for setInterval)

---

## Priority 3: Implement Keytar (HIGH)

### Why This Matters
- OAuth tokens currently stored in plain text
- Security risk

### Implementation
1. Install keytar: `npm install keytar`
2. Create `desktop-app/keytar-wrapper.js` (reference: KEYTAR_IMPLEMENTATION.md)
3. Update `main.js` to use keytar
4. Test token save/load

### Files to Create
- `desktop-app/keytar-wrapper.js` (100 lines)

### Files to Modify
- `desktop-app/main.js` (add token encryption)

### Testing
1. Set OAuth token
2. Restart app
3. Verify token still works

---

## Priority 4: Auto-Updater Configuration (MEDIUM)

### Why This Matters
- Users can't use their own forks
- Hardcoded GitHub repo

### Implementation
1. Create `update-config.json` in app data directory
2. Add IPC handlers in `main.js`
3. Add UI in `dashboard.html`

### Files to Create
- Config file (auto-created on first run)

### Files to Modify
- `desktop-app/main.js` (add loadUpdateConfig, IPC handlers)
- `desktop-app/server/dashboard.html` (add UI)

### Testing
1. Launch app
2. Check Settings tab
3. Update owner/repo
4. Restart app
5. Verify update checks new repo

---

## Priority 5: Complete Incomplete Features (HIGH)

### What's Incomplete

#### 1. Viewer Dashboard Twitch OAuth
- **Location**: `desktop-app/server/viewer-dashboard.html`
- **Status**: Partially implemented
- **Work**: Complete OAuth flow for viewer customization

#### 2. Movement Commands (!cw, !ccw)
- **Status**: Exist in code but untested
- **Work**: Test that rotation commands work
- **Test**: Type `!cw` in chat, watch viewer rotate

#### 3. Bits Requirement
- **Status**: UI exists but not enforced
- **Work**: Implement bits checking in `canUserJoin()` function

### Implementation Steps

1. **Test Movement Commands**:
   - Add test user
   - Type `!cw` in chat
   - Verify rotation clockwise
   - Type `!ccw`
   - Verify counter-clockwise

2. **Implement Bits Requirement**:
   ```javascript
   // In main.js canUserJoin() function
   if (settings.bitsRequired && settings.bitsRequired > 0) {
       if (!user.bits || user.bits < settings.bitsRequired) {
           return false; // User hasn't met bits requirement
       }
   }
   ```

3. **Complete Viewer OAuth**:
   - Setup OAuth flow for viewer dashboard
   - Let viewers customize colors/sprites without streamer
   - Save preferences to disk

---

## Priority 6: State Management (LOW)

### Current State Issues
- Multiple sources of truth (localStorage, main process, file system)
- Sync mechanisms complex and fragile
- Race conditions possible

### Proposed Solution
- Centralize state in main process
- Push changes to renderer processes via IPC
- File system as persistence layer only

### Architecture
```
Main Process (Source of Truth)
├── activeUsers (Map)
├── settings (Object)
├── viewerPrefs (Map)
└── Broadcasts via IPC

Widget Window
├── Local cache of activeUsers (for rendering)
└── Listens for IPC updates

Dashboard Window
├── Local cache of settings
└── Listens for IPC updates

File System
└── Persistence (read on startup, write on change)
```

### Implementation Steps
1. Create state manager module in main.js
2. Add IPC handlers for state updates
3. Replace direct localStorage writes with IPC calls
4. Test sync between windows

---

## Implementation Schedule

### Week 1
- [ ] Module refactoring (widget.html → js/)
- [ ] Event-based polling audit & fixes

### Week 2
- [ ] Keytar integration
- [ ] Auto-updater configuration

### Week 3
- [ ] Complete incomplete features
- [ ] Full end-to-end testing

### Week 4
- [ ] State management refactor
- [ ] Performance optimization
- [ ] Release v0.0.22

---

## Testing Checklist

Before releasing each improvement:

- [ ] App starts without errors
- [ ] Dashboard loads
- [ ] Widget displays
- [ ] Twitch connection works
- [ ] Settings save/load
- [ ] Commands execute (!join, !leave, etc.)
- [ ] User appears/disappears
- [ ] Sprite loads correctly
- [ ] Colors correct
- [ ] No console errors
- [ ] Performance acceptable

---

## Resources

- [ERROR_HANDLING_STANDARD.md](ERROR_HANDLING_STANDARD.md) - Use these patterns
- [KEYTAR_IMPLEMENTATION.md](KEYTAR_IMPLEMENTATION.md) - Token encryption guide
- [AUTO_UPDATER_CONFIG.md](AUTO_UPDATER_CONFIG.md) - Auto-updater setup
- [COMPREHENSIVE_ANALYSIS.md](COMPREHENSIVE_ANALYSIS.md) - Full issue details

---

## Questions?

If stuck on any of these:
1. Check the referenced guide
2. Look at examples in the codebase
3. Test with mock data first
4. Add console.log() to debug
5. Check browser DevTools (F12)

---

**Good luck with the next sprint! 🚀**
