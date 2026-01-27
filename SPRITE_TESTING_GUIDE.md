# Sprite System Testing Guide

## How to Test

The app is now running. To test the sprite system:

### 1. Open Dashboard
- Click the "Dashboard" button in the widget menu bar
- OR use the system tray menu → "Open Dashboard"

### 2. Check Console Output

**In Dashboard:**
- Open DevTools (View → Developer → Toggle Developer Tools, or Cmd+Option+I on Mac)
- Look for messages like:
  - `🔄 Loading shadow sprites... (Electron mode)`
  - `✅ Loaded X shadow sprites from folder`
  - `✅ Shadow sprites already loaded: X sprites`

**In Widget Window:**
- Open DevTools (same as above)
- Look for messages like:
  - `Sprite collections loaded - RPG: X Shadows: X Morph: X`
  - `[getUserSprite] UserName - Mode: circle, RPG: X Shadows: X Morph: X`

### 3. Test Sprite Mode Switching

1. **Open Quick Settings** in the widget (top menu bar)
2. **Change sprite mode** from dropdown:
   - "SHADOWS (colored circles)" - should use shadow sprites
   - "ADVENTURERS (pixel characters)" - should use RPG sprites  
   - "MORPHS (animated morphs)" - should use morph sprites

3. **Observe users**:
   - Users should have sprites (not disappear)
   - Each user should get a sprite when mode changes
   - Switching back to a mode should restore their previous sprite for that mode

### 4. Expected Behavior

✅ **Should Work:**
- Sprites appear for all users when mode is selected
- Users keep their sprites when switching modes
- Switching back to a mode shows the same sprites users had before
- SVG circle appears as fallback if no sprites available

❌ **Should NOT Happen:**
- Users disappearing when mode changes
- All users getting the same sprite
- Sprites not appearing at all (except fallback circle)
- Console errors about sprite loading

### 5. Check for Errors

Look for these console messages:
- `❌ Error loading shadow sprites from folder`
- `Error parsing shadowSprites`
- `No shadow sprites found in localStorage`
- `[getUserSprite] No shadow sprites available... using SVG circle fallback`

### 6. Verify localStorage

In DevTools Console, run:
```javascript
// Check if shadow sprites are loaded
JSON.parse(localStorage.getItem('shadowSprites') || '[]').length
// Should be > 0 if loaded successfully

// Check RPG sprites
JSON.parse(localStorage.getItem('rpgSprites') || '[]').length
// Should be 20

// Check morph sprites  
JSON.parse(localStorage.getItem('morphSprites') || '[]').length
// Should be 10
```

---

## Current Status

The app is running. Please:
1. Open Dashboard and check console for sprite loading messages
2. Try switching sprite modes in Quick Settings
3. Report what you see (working / not working / errors)
