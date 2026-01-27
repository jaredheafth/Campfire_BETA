# 🎨 Sprite Verification Guide

## ✅ Sprite Files Should Be Included

The sprite files are configured to be included in the desktop installer:

1. **Setup Script Copies Sprites**: `setup.sh` copies all sprites from `../sprites/` to `server/sprites/`
2. **electron-builder Configuration**: `package.json` includes `"server/**/*"` which matches `server/sprites/**/*`
3. **Sprite Files Present**: 31 GIF files are in `desktop-app/server/sprites/defaults/`

## 📍 Where Sprites Should Be Installed

When the desktop app is installed, sprites should be located at:

**Windows:**
```
C:\Users\[YourUsername]\AppData\Local\Programs\campfire-widget-desktop\resources\app\server\sprites\defaults\
```

**Mac:**
```
/Applications/Campfire Widget.app/Contents/Resources/app/server/sprites/defaults/
```

## 🔍 How to Verify Sprites Are Installed

1. **Install the desktop app** from the installer
2. **Navigate to the app directory**:
   - **Windows**: Right-click the app icon → "Open file location" → Go up to `resources\app\server\sprites\defaults\`
   - **Mac**: Right-click the app → "Show Package Contents" → `Contents\Resources\app\server\sprites\defaults\`
3. **Check for sprite files**:
   - `rpg-characters/` folder should have 19 GIF files
   - `pixel-morphs/` folder should have 11 GIF files
   - `circles/` folder should have 1 GIF file

## 🐛 If Sprites Are Missing

If sprites are not present after installation:

1. **Check if `setup.sh` was run** before building:
   ```bash
   cd desktop-app
   ./setup.sh
   ```

2. **Verify sprites exist before building**:
   ```bash
   ls -la server/sprites/defaults/rpg-characters/*.gif
   ```

3. **Rebuild with explicit sprite check**:
   ```bash
   # Make sure setup.sh copied sprites
   ./setup.sh
   
   # Verify they're there
   find server/sprites/defaults -name "*.gif" | wc -l
   # Should show 31 files
   
   # Then build
   npm run build:win
   ```

4. **Check electron-builder output** during build - it should list sprite files

## ✅ Expected Sprite Count

- **RPG Characters**: 19 GIF files
- **Pixel Morphs**: 11 GIF files  
- **Circles**: 1 GIF file
- **Total**: 31 GIF files

## 📝 Note

The `"server/**/*"` pattern in `package.json` should match:
- `server/sprites/**/*.gif`
- `server/sprites/**/*.svg`
- `server/sprites/**/*.png`
- All other files in `server/`

If sprites are still missing, the issue might be:
1. `setup.sh` wasn't run before building
2. electron-builder is excluding them (check build output)
3. Files aren't being copied to the installation directory
