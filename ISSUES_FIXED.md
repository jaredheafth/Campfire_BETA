# Issues Fixed - Sprite System & Settings

## Critical Fixes Applied

### 1. ✅ updateSpriteMode() - No More Page Reloads
**Problem:** `updateSpriteMode()` was calling `location.reload()` which destroyed all users.

**Fix:** Changed to use `widget.updateSettings({ spriteMode: spriteMode })` which preserves users and just updates sprites.

### 2. ✅ Quick Settings Functions - Now Use updateSettings
**Problem:** `updateMaxUsers()` and `updateJoinMethod()` were directly modifying settings without using the update system.

**Fix:** Both now call `widget.updateSettings()` which properly handles state updates.

### 3. ✅ Member Toggle Refresh
**Problem:** Individual member toggles weren't refreshing the member list after toggling.

**Fix:** Added `loadDashboardMembers()` refresh calls after toggling test users.

### 4. ✅ Sprite Loading Safety - Elements Stay Visible
**Problem:** `updateUserElement()` hides elements with `display: none` and if sprite loading fails or is cached (onload doesn't fire), elements stay hidden.

**Fix:** 
- Improved cached image detection
- Added timeout fallback that forces elements to show even if sprite loading has issues
- Better handling of cached images

## Remaining Issues to Investigate

### 5. ⚠️ Users Disappearing on Settings/Tab Changes
**Suspected Cause:** When settings update, `updateUserElement()` is called for all users. Elements are hidden during sprite reload, but may not reappear if:
- Sprite loading fails silently
- Cached images don't trigger onload
- Error handler doesn't show fallback properly

**Next Steps:** 
- Test if elements are actually being removed from DOM or just hidden
- Check if `updateUserElement` is being called too frequently
- Verify sprite loading is completing successfully

### 6. ⚠️ State Sync Issues
**Problem:** Users animate out but code thinks they're still there (need to HIDE ALL then SHOW ALL to fix).

**Possible Causes:**
- Users are in `this.users` array but elements are hidden/removed
- State is out of sync between widget and main process
- Test users being filtered out in savePersistedUsers

**Note:** `Saved 0 users to localStorage` is expected for test users (they're filtered out), but the real issue is that elements are disappearing.

## Testing Checklist

- [ ] Test sprite mode switching - users should NOT disappear
- [ ] Test tab switching - users should NOT disappear  
- [ ] Test individual member toggles - should refresh properly
- [ ] Test settings changes - users should NOT disappear
- [ ] Check console for sprite loading errors
- [ ] Verify elements are actually in DOM (even if hidden)

## Files Modified

1. `desktop-app/server/widget.html`
   - `updateSpriteMode()` - fixed to use updateSettings
   - `updateMaxUsers()` - fixed to use updateSettings
   - `updateJoinMethod()` - fixed to use updateSettings  
   - `updateUserElement()` - improved sprite loading safety

2. `desktop-app/server/dashboard.html`
   - `dashboardToggleTestUser()` - added member list refresh

---

**Status**: Critical fixes applied. Need to test if users still disappear on settings/tab changes.
