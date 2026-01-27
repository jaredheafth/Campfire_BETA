# Legacy Server (Optional/Deprecated)

⚠️ **This is a legacy/optional server. We recommend using the Desktop Application instead!**

The desktop app (see [README.md](README.md)) is recommended for:
- Easier installation (one-click installer)
- Automatic updates
- Better performance
- Full Twitch integration
- System tray integration

---

## When to Use This Server

Use `server.js` only if you:
- Want to host on your own web server
- Need to run on non-Windows/macOS platforms
- Want to use with StreamLabs OBS Custom Widget
- Are deploying to a hosting service (Railway, Heroku, etc.)

---

## Local Setup

### Prerequisites

- Node.js 14+ installed
- npm or yarn
- Twitch OAuth token (see below)

### Installation

1. **Install dependencies**:
   ```bash
   npm install express tmi.js multer
   ```

2. **Get Twitch OAuth Token**:
   - Visit [Twitch Token Generator](https://twitchtokengenerator.com/)
   - Select `chat:read` scope
   - Generate token
   - Copy token for next step

3. **Create config file** (`twitch-config.json`):
   ```json
   {
     "username": "your_twitch_username",
     "password": "oauth:your_oauth_token",
     "channels": ["your_channel_name"]
   }
   ```

4. **Run the server**:
   ```bash
   node server.js
   ```

5. **Access dashboard**:
   - Open http://localhost:3000/dashboard.html
   - Configure settings
   - Copy widget code
   - Add to OBS as Browser Source

---

## Web Hosting (Railway, Heroku, etc.)

### Railway Setup

1. **Fork this repository** on GitHub
2. **Connect to Railway**:
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub"
   - Select your fork
   - Railway automatically detects Node.js project

3. **Set environment variables**:
   - In Railway dashboard, click "Variables"
   - Add:
     ```
     TWITCH_USERNAME=your_username
     TWITCH_PASSWORD=oauth:your_token
     TWITCH_CHANNEL=your_channel
     PORT=3000
     ```

4. **Deploy**:
   - Railway automatically deploys on git push
   - Your app URL: `https://your-project.railway.app`

5. **Access widget**:
   - Dashboard: `https://your-project.railway.app/dashboard.html`
   - Widget: `https://your-project.railway.app/widget.html`

### Heroku Setup

1. **Create Heroku app**:
   ```bash
   heroku login
   heroku create your-app-name
   ```

2. **Set config vars**:
   ```bash
   heroku config:set TWITCH_USERNAME=your_username
   heroku config:set TWITCH_PASSWORD=oauth:your_token
   heroku config:set TWITCH_CHANNEL=your_channel
   ```

3. **Deploy**:
   ```bash
   git push heroku main
   ```

---

## Configuration

### Environment Variables

```bash
# Twitch
TWITCH_USERNAME=your_bot_username
TWITCH_PASSWORD=oauth:your_token
TWITCH_CHANNEL=your_channel_name

# Server
PORT=3000  # Railway sets this automatically
NODE_ENV=production

# Optional
UPLOAD_DIR=/tmp/uploads
MAX_UPLOAD_SIZE=10MB
```

### twitch-config.json

```json
{
  "username": "bot_username",
  "password": "oauth:token_here",
  "channels": ["channel_name"],
  "identity": {
    "username": "bot_username",
    "password": "oauth:token_here"
  },
  "connection": {
    "reconnect": true,
    "secure": true
  }
}
```

---

## API Endpoints

### Widget & Dashboard
- `GET /` - Redirects to dashboard
- `GET /dashboard.html` - Settings dashboard
- `GET /widget.html` - Widget display

### Static Files
- `GET /sprites/...` - Sprite files
- `GET /assets/...` - Asset files
- `GET /fonts/...` - Font files

### REST API
- `GET /api/status` - Server status
- `GET /api/users` - Active users
- `GET /api/settings` - Current settings
- `POST /api/settings` - Update settings

---

## Troubleshooting

### "Cannot find module 'express'"
```bash
npm install
```

### "Connection failed"
- Check Twitch OAuth token is correct
- Verify channel name (lowercase, no spaces)
- Check internet connection

### "Port already in use"
```bash
# Change port in code or use:
PORT=8000 node server.js
```

### "Settings not saving"
- Check file permissions in upload directory
- Verify `campfire-widget-settings.json` isn't read-only
- Check browser console for errors

### "Sprites not loading"
- Verify `/sprites` directory exists
- Check file permissions
- Try refreshing widget

---

## Migration to Desktop App

If you started with the server and want to switch to the desktop app:

1. **Export settings** from dashboard
2. **Download desktop app** from releases
3. **Import settings** in app dashboard
4. **Update OBS** to use new widget code

---

## Performance Notes

- Handles ~100 concurrent users
- Uses about 100-200 MB RAM
- CPU usage depends on number of users
- Render times under 50ms per frame

For more users, consider:
- Horizontal scaling (multiple servers)
- Database backend (currently uses in-memory + localStorage)
- CDN for sprite files

---

## Security Considerations

⚠️ **Important**:
- Don't commit `twitch-config.json` to git!
- Use environment variables for tokens
- Change upload directory on shared hosting
- Enable HTTPS in production
- Rate limit API endpoints
- Validate all user inputs

---

## Deprecated Features

The following features from v0.0.x are no longer actively developed:

- ❌ YouTube chat integration
- ❌ Custom bot commands
- ❌ Multi-platform support (Windows/macOS preferred)
- ❌ Self-hosted key-value store

Use the desktop app for these features.

---

## Support

For issues with `server.js`:
1. Check error logs
2. Verify configuration
3. Test in development first
4. [Report issue](https://github.com/jaredheafth/offlineclub_widget_Campfire/issues) with:
   - Error message
   - Steps to reproduce
   - Environment (OS, Node version)

---

## See Also

- [README.md](README.md) - Main documentation
- [QUICK_START.md](QUICK_START.md) - Quick start guide
- [desktop-app/](desktop-app/) - Desktop app folder
