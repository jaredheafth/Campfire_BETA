@echo off
REM Quick Install Script - Runs the pre-built installer
REM Use build-and-install.bat if you need to rebuild from source

echo.
echo ================================================
echo   🔥 Campfire Widget - Quick Install
echo ================================================
echo.

set "SCRIPT_DIR=%~dp0"

if exist "%SCRIPT_DIR%dist\Campfire-Widget-Setup-0.1.6.exe" (
    echo 📦 Found installer:
    echo    %SCRIPT_DIR%dist\Campfire-Widget-Setup-0.1.6.exe
    echo.
    echo 🚀 Launching installer...
    echo.
    "%SCRIPT_DIR%dist\Campfire-Widget-Setup-0.1.6.exe"
) else (
    echo ❌ Installer not found!
    echo.
    echo The pre-built installer doesn't exist yet.
    echo Please run: build-and-install.bat
    echo.
    pause
)
