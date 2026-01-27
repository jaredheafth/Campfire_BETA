# Standalone Desktop App Guide

The Campfire Widget desktop app is **fully standalone** - you don't need to open a browser or navigate to localhost. Everything works within the Electron application window.

## How It Works

1. **Download & Install**: Run the installer (`.exe` on Windows, `.dmg` on Mac)
2. **Launch App**: Open "Campfire Widget" from your Applications/Programs
3. **Auto-Start**: The server starts automatically in the background
4. **Dashboard Opens**: The dashboard appears in the app window (no browser needed!)

## Built-in Twitch Token Generator

The dashboard now includes a **Twitch Connection** tab with a built-in OAuth token generator:

### Steps to Connect:

1. **Open the "📺 Twitch" tab** in the dashboard
2. **Click "🔑 Generate Twitch Token"**
   - A window will open asking you to authorize the app
   - Log in to Twitch and click "Authorize"
   - The token will be automatically filled in
3. **Enter your details**:
   - **Twitch Username**: Your Twitch username
   - **Channel Name**: Your channel name (without #)
4. **Click "💾 Save Twitch Configuration"**
5. **Restart the server** (or restart the app) to apply changes

### No Manual Token Generation Needed!

You no longer need to:
- ❌ Visit twitchtokengenerator.com
- ❌ Copy/paste tokens manually
- ❌ Edit server.js files

Everything is handled through the dashboard UI!

## What Happens Behind the Scenes

When you launch the app:

1. **Server Starts**: A Node.js server runs on `localhost:3000` (internal only)
2. **Dashboard Loads**: The Electron window loads `http://localhost:3000/dashboard.html`
3. **Everything Works**: All features work exactly as if you opened it in a browser

**Important**: You don't need to open a browser! The Electron window IS your dashboard.

## Configuration Files

The app stores configuration in:
- `desktop-app/server/twitch-config.json` - Twitch credentials
- `desktop-app/server/campfire-widget-settings.json` - Widget settings

These are automatically created and managed by the dashboard.

## Troubleshooting

### "Dashboard won't load"

- Check if the server is running (look for "🟢 Server Running" in the tray menu)
- Restart the app if needed
- Check the console for errors (if DevTools are enabled)

### "Twitch token generation doesn't work"

- Make sure you're using the desktop app (not opening in a browser)
- The OAuth window should open automatically when you click "Generate Token"
- If it doesn't open, check that pop-ups aren't blocked

### "Server won't start"

- Make sure Node.js is installed (comes bundled with the app)
- Check that port 3000 isn't already in use
- Try restarting the app

## For Distribution

When building the installer:

1. **All dependencies are bundled** - Users don't need Node.js installed
2. **Server runs automatically** - No manual setup required
3. **Dashboard is integrated** - No browser needed
4. **One-click install** - Standard installer experience

## Next Steps After Installation

1. ✅ Launch the app
2. ✅ Go to "📺 Twitch" tab
3. ✅ Generate your token
4. ✅ Configure your settings
5. ✅ Copy widget code to OBS
6. ✅ Start streaming!

The entire process is now **completely standalone** - no external websites, no manual file editing, no browser required!
