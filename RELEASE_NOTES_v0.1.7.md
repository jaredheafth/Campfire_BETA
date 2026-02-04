# Campfire Widget v0.1.7 Release Notes

## Dashboard Improvements

### GLOW Tab Removed
- Merged all GLOW settings into the CAMPFIRE tab
- Reduced tab count from 11 to 10 for cleaner interface
- All glow controls now accessible within CAMPFIRE tab

### Scrollable Tab Content
- Fixed scrolling in all tab sections
- Main tabs stay fixed at top
- Sub-tabs (like in COMMANDS) stay fixed while content scrolls
- Applied `.tab-fixed-header` and `.tab-scrollable-content` CSS classes

### Sub-tab Wrapping Fix
- Fixed COMMANDS tab sub-tabs to stay on one line
- Added `flex-wrap: nowrap` and `overflow-x: auto` for horizontal scrolling

## Bug Fixes

### Command Settings Not Saving
- Fixed duplicate default command arrays causing conflicts
- Updated `normalizeBotMessage()` in main.js to preserve command-specific properties:
  - `returnFromStates` for Return command
  - `triggerStates` for Auto-Return command
- Added missing properties to duplicate arrays in `editBotMessage()`

### Toggle Switches Not Working
- Fixed Sleepy State toggle and other command toggles
- Fixed Auto-Return Sleepy checkbox persistence
- All command settings now save and persist correctly

## Files Modified

### Dashboard
- `desktop-app/server/dashboard.html` - Removed GLOW tab, fixed scrolling structure
- `desktop-app/server/styles/dashboard-base.css` - Added fixed header/scrollable content classes
- `desktop-app/server/styles/dashboard-tabs.css` - Fixed display properties for scrolling

### Main Process
- `desktop-app/main.js` - Added command-specific property preservation in normalizeBotMessage()

## Technical Details

The command saving issue was caused by:
1. Multiple conflicting default command arrays in dashboard.html
2. `normalizeBotMessage()` only preserving properties for 'who' command
3. Missing `triggerStates` and `returnFromStates` property handling

All issues resolved with consolidated defaults and proper property preservation.
