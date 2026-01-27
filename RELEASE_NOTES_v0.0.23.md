# Release Notes v0.0.23

## Release Date: January 26, 2026

## Summary

This release fixes a critical UI issue with menu bar buttons in transparent background mode on Windows, and adds proactive chat color fetching for authenticated users (streamer/bot accounts).

---

## Bug Fixes

### Fixed: Menu Bar Buttons Not Clickable in Transparent Mode (Windows)

**Issue:** In transparent background mode on Windows, menu bar buttons (Settings, Members, Chat, etc.) were unresponsive to clicks. Users had to click multiple times or in specific areas to trigger button actions.

**Root Cause:** The CSS rule `body.frameless .desktop-menu-bar { -webkit-app-region: drag; }` made the entire menu bar a drag region. While nested buttons had `-webkit-app-region: no-drag`, this is unreliable on Windows with transparent windows due to a known Chromium/Electron bug.

**Solution:** Added a dedicated 24px drag strip above the menu buttons with a grip icon (⋮⋮⋮). The drag strip has `-webkit-app-region: drag`, while the menu bar itself now has `no-drag` so buttons click reliably.

**Visual Change:** A thin drag strip with grip icon now appears above the menu bar in transparent mode. Users can drag the window from this strip.

---

## Enhancements

### Proactive Chat Color Fetching for Authenticated Users

**Issue:** Username colors displayed above sprites used a hash-based fallback color until the user sent a chat message, at which point the color would update to their real Twitch color. This caused a visual "pop" when colors changed.

**Enhancement:** The app now proactively fetches chat colors for the streamer and bot accounts during startup using the Twitch Helix API (`GET /helix/chat/color`). This ensures authenticated users display their correct Twitch chat color immediately upon joining.

**New OAuth Scope:** Added `user:read:chat` scope to the main account OAuth flow. This scope is required to fetch user chat colors from the Helix API.

**Note:** This enhancement only applies to the streamer and bot accounts (authenticated users). Regular viewers will still use the hash-based fallback until they send a chat message, as fetching colors for all viewers would require excessive API calls.

### Improved Bot Account Status Indicator

**Issue:** The bot account section in the Twitch tab showed disabled inputs with no visual feedback about whether credentials were saved or if the bot was connected. Password fields appeared empty even when credentials were stored.

**Enhancement:** Added a status indicator below the "🤖 Chat Bot Account" header that shows:
- 🟢 **Connected** - When using main account or separate bot with active connection
- 🟡 **Credentials saved** - When separate bot credentials are saved but not yet connected
- 🟠 **Missing token** - When username is set but token is missing
- ⚪ **Not configured** - When no bot account is set up

Also added explanatory text clarifying that the bot account shares the main connection to Twitch.

---

## Technical Changes

### Files Modified

- **`desktop-app/server/widget.html`**
  - Added `.menu-drag-strip` CSS class for the new drag strip
  - Modified `body.frameless .desktop-menu-bar` to use `no-drag`
  - Added drag strip HTML element with grip icon

- **`desktop-app/src/main/constants.js`**
  - Added `user:read:chat` to `MAIN_ACCOUNT_SCOPES`

- **`desktop-app/main.js`**
  - Added `fetchUserChatColor()` function to fetch colors from Helix API
  - Modified `fetchAndStoreRealTwitchIds()` to also fetch and store chat colors
  - Modified `simulate-join-command` handler to use pre-fetched colors

- **`desktop-app/TWITCH_OAUTH_AND_RESTRICTIONS.md`**
  - Updated documentation to list all OAuth scopes
  - Updated summary table with complete scope list

- **`desktop-app/server/dashboard.html`**
  - Added bot account status indicator with dynamic status updates
  - Added `updateChatBotStatusIndicator()` function
  - Added explanatory text about bot account connection behavior
  - Modified `toggleChatBotInputs()` to update status indicator
  - Modified `updateTwitchStatusFromMain()` to update bot status indicator

---

## OAuth Scope Changes

### Main Account (Streamer)
- `chat:read` – Read chat messages
- `chat:edit` – Send chat messages
- `channel:read:subscriptions` – Read subscriber information
- `moderator:read:chatters` – Read list of chatters in channel
- `user:read:chat` – **NEW:** Read user chat colors

### Bot Account (if separate)
- `chat:read` – Read chat messages
- `chat:edit` – Send chat messages

**Note:** Existing users may need to re-authenticate to grant the new `user:read:chat` scope. The app will continue to work without it, but chat colors for the streamer/bot won't be fetched proactively.

---

## Upgrade Notes

1. **Re-authentication may be required** for the new `user:read:chat` scope
2. **Visual change** in transparent mode: new drag strip above menu bar
3. No breaking changes to existing functionality

---

## Known Issues

- Chat colors for regular viewers still use hash-based fallback until they chat
- The drag strip is only visible in transparent/frameless mode
