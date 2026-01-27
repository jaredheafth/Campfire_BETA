@echo off
REM Setup script for desktop app (Windows)
REM Copies server files and prepares for building

echo 🔥 Campfire Widget Desktop App Setup
echo ====================================
echo.

REM Create server directory if it doesn't exist
if not exist "server" mkdir server

REM Copy server files
echo 📁 Copying server files...
copy ..\server.js server\ >nul
copy ..\dashboard.html server\ >nul
copy ..\widget.html server\ >nul
copy ..\viewer-dashboard.html server\ >nul
copy ..\package.json server\ >nul

REM Copy sprite files (if sprites directory exists)
if exist "..\sprites" (
    echo 📁 Copying sprite files...
    if not exist "server\sprites" mkdir server\sprites
    xcopy /E /I /Y ..\sprites server\sprites >nul 2>&1
    echo ✅ Sprite files copied
    echo    Verifying sprite files were copied...
    dir /s /b server\sprites\defaults\*.gif 2>nul | find /c ".gif" > temp_sprite_count.txt
    set /p SPRITE_COUNT=<temp_sprite_count.txt
    del temp_sprite_count.txt
    echo    Found %SPRITE_COUNT% sprite GIF files
)

REM Create assets directory if it doesn't exist
if not exist "assets" mkdir assets

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Add app icons to assets\ folder:
echo    - icon.png (512x512) - Fallback
echo    - icon.ico (256x256) - Windows
echo    - icon.icns (512x512) - Mac
echo.
echo 2. Install dependencies:
echo    npm install
echo.
echo 3. Install server dependencies:
echo    cd server ^&^& npm install ^&^& cd ..
echo.
echo 4. Build installers:
echo    npm run build:win    # Windows
echo    npm run build:mac    # Mac
echo    npm run build:all    # Both
echo.
pause
