# 🔧 Fixing Sprite Inclusion in Installer

## Issue
Sprite files are not being included in the installed desktop app.

## Root Cause
The `server/**/*` pattern in electron-builder's `files` configuration may not reliably match all sprite files, especially during the build process.

## Solution Applied

1. **Added `extraFiles` configuration** to explicitly include sprites:
   ```json
   "extraFiles": [
     {
       "from": "server/sprites",
       "to": "server/sprites",
       "filter": ["**/*"]
     }
   ]
   ```

2. **Enhanced setup scripts** to verify sprite copying:
   - `setup.sh` (Mac/Linux) now counts sprite files after copying
   - `setup.bat` (Windows) now counts sprite files after copying

## Important: Run setup.sh BEFORE building

**You MUST run `./setup.sh` (or `setup.bat` on Windows) before building installers!**

The setup script:
1. Copies all server files to `desktop-app/server/`
2. Copies all sprite files to `desktop-app/server/sprites/`
3. Verifies that sprite files were copied correctly

## Build Process (Updated)

```bash
# 1. Run setup script FIRST (copies sprites)
cd desktop-app
./setup.sh    # Mac/Linux
# OR
setup.bat     # Windows

# 2. Verify sprites are there
find server/sprites/defaults -name "*.gif" | wc -l
# Should show 31 files

# 3. Build installer
npm run build:win    # Windows
# OR
npm run build:mac    # Mac

# 4. Verify installer includes sprites (optional - check dist folder before installing)
```

## Verification After Installation

After installing the desktop app, check:

**Windows:**
```
C:\Users\[YourUsername]\AppData\Local\Programs\campfire-widget-desktop\resources\app\server\sprites\defaults\
```

**Mac:**
```
/Applications/Campfire Widget.app/Contents/Resources/app/server/sprites/defaults/
```

You should see:
- `rpg-characters/` folder with 20 GIF files
- `pixel-morphs/` folder with 10 GIF files
- `circles/` folder with 1 GIF file

## If Sprites Still Missing

1. **Check if setup.sh ran**: Look for "✅ Sprite files copied" message
2. **Verify sprite count**: Setup script should report ~31 sprite files
3. **Rebuild with clean start**:
   ```bash
   rm -rf dist/
   rm -rf server/sprites
   ./setup.sh
   npm run build:win
   ```
4. **Check build output**: electron-builder should list sprite files being packaged

## Technical Details

- `extraFiles` puts files in `resources/app/server/sprites/` (same as `files`)
- Both `files` and `extraFiles` include sprites as a backup
- Setup script now verifies sprites exist before building
- This ensures sprites are definitely included in the installer
