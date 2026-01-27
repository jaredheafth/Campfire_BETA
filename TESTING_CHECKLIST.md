# Testing Checklist - Sprite System Fixes

The app is starting up. Please test the following:

## ✅ Quick Settings Tests

1. **Sprite Mode Switching**
   - Open Quick Settings (menu bar)
   - Change sprite mode dropdown:
     - SHADOWS → ADVENTURERS → MORPHS → back to SHADOWS
   - ✅ **Expected:** Users should NOT disappear
   - ✅ **Expected:** Users should switch to new sprite type
   - ✅ **Expected:** When switching back, users should have their previous sprites for that mode

2. **Max Users Setting**
   - Change "Maximum Users" number
   - ✅ **Expected:** Setting should update without users disappearing

3. **Join Method Setting**
   - Change "Join Method" dropdown
   - ✅ **Expected:** Setting should update without users disappearing

## ✅ Tab Switching Tests

4. **Switch Between Tabs**
   - Switch between "Quick Settings" and "Members" tabs
   - ✅ **Expected:** Users should NOT disappear
   - ✅ **Expected:** Widget should remain stable

## ✅ Member Management Tests

5. **Individual Member Toggles** (Test Users)
   - In Members tab, click individual toggle switches for TestUser1, TestUser2, TestUser3
   - ✅ **Expected:** Toggle should respond immediately
   - ✅ **Expected:** User should appear/disappear from widget
   - ✅ **Expected:** Member list should refresh to show updated status

6. **SHOW ALL / HIDE ALL Buttons**
   - Click "SHOW ALL" - all test users should appear
   - Click "HIDE ALL" - all test users should disappear
   - ✅ **Expected:** Should work as before

## ✅ Settings Changes Tests

7. **Adjust Settings** (in Dashboard)
   - Change any setting (fire size, sprite size, etc.)
   - ✅ **Expected:** Users should NOT disappear
   - ✅ **Expected:** Changes should apply smoothly

## 🔍 Things to Watch For

- **Console Errors:** Check browser console (DevTools) for any errors
- **Sprite Loading:** Watch for console messages about sprite loading
- **User Count:** Verify users stay in the widget (check member count)
- **Visual:** Users should remain visible throughout all operations

## 🐛 If Issues Persist

If users still disappear:
1. Check console for errors
2. Note what action triggered the disappearance
3. Check if elements are actually removed or just hidden (inspect DOM)
4. Report specific steps to reproduce

---

**Ready for testing!** The app windows should be opening now.
