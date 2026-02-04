@echo off
REM Build and Install Campfire Widget Desktop App
REM This script builds the installer and optionally runs it

echo.
echo ================================================
echo   🔥 Campfire Widget - Build & Install Script
echo ================================================
echo.

REM Get the directory of this script
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from https://nodejs.org/
    echo Then run this script again.
    pause
    exit /b 1
)

echo ✅ Node.js found
node --version
echo.

REM Step 1: Run setup
echo 📁 Step 1: Running setup...
if exist "setup.bat" (
    call setup.bat
) else (
    echo ⚠️  setup.bat not found, skipping file sync...
)
echo.

REM Step 2: Install main dependencies
echo 📦 Step 2: Installing main dependencies...
echo (This may take a few minutes on first run)
echo.
npm install --prefer-offline --no-audit
if errorlevel 1 (
    echo ❌ npm install failed!
    pause
    exit /b 1
)
echo ✅ Main dependencies installed
echo.

REM Step 3: Install server dependencies
echo 📦 Step 3: Installing server dependencies...
cd server
npm install --prefer-offline --no-audit
if errorlevel 1 (
    echo ❌ Server npm install failed!
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✅ Server dependencies installed
echo.

REM Step 4: Build Windows installer
echo 🔨 Step 4: Building Windows installer...
echo (This may take several minutes)
echo.
npm run build:win
if errorlevel 1 (
    echo ❌ Build failed!
    pause
    exit /b 1
)
echo.

REM Step 5: Show results
echo ================================================
echo   ✅ Build Complete!
echo ================================================
echo.
echo 📦 Installer location:
echo    %SCRIPT_DIR%dist\Campfire-Widget-Setup-%version%.exe
echo.
echo.
setlocal enabledelayedexpansion
set "installer=Campfire-Widget-Setup-0.1.6.exe"
if exist "%SCRIPT_DIR%dist\!installer!" (
    echo 🎉 Ready to install!
    echo.
    echo Would you like to run the installer now?
    echo.
    echo [Y] Yes, run installer
    echo [N] No, I'll run it manually
    echo.
    set /p choice="Enter your choice: "
    if /i "!choice!"=="Y" (
        echo.
        echo 🚀 Running installer...
        echo.
        start "" "%SCRIPT_DIR%dist\!installer!"
    )
)
echo.
echo 📖 The installer will:
echo    - Install Campfire Widget to your Programs
echo    - Create Start Menu shortcut
echo    - Create Desktop shortcut
echo.
echo After installation, launch from Start Menu or Desktop!
echo.
pause
