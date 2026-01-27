# 🚀 Quick Start Guide - Local MVP

Get your campfire widget working with real Twitch chat in 5 minutes!

## Step 1: Install Node.js

If you don't have Node.js installed:
- Download from: https://nodejs.org/
- Install the LTS version
- Verify: Open terminal and run `node --version`

## Step 2: Install Dependencies

Open terminal in this folder and run:

```bash
npm install
```

This installs:
- `express` - Web server
- `tmi.js` - Twitch chat client

## Step 3: Get Twitch OAuth Token

1. Go to: **https://twitchtokengenerator.com/**
2. Select scope: **`chat:read`**
3. Click "Generate Token"
4. **Copy the token** (starts with `oauth:`)

## Step 4: Configure Server

Open `server.js` and update these lines (around line 20):

```javascript
const CONFIG = {
    BOT_USERNAME: 'your_twitch_username',        // Your Twitch username
    OAUTH_TOKEN: 'oauth:paste_your_token_here',  // Token from step 3
    CHANNEL_NAME: 'your_channel_name'            // Your channel (no #)
};
```

**Example:**
```javascript
const CONFIG = {
    BOT_USERNAME: 'jaredheath',
    OAUTH_TOKEN: 'oauth:abc123xyz789',
    CHANNEL_NAME: 'jaredheath'
};
```

## Step 5: Start the Server

Run:

```bash
npm start
```

You should see:
```
✅ Connected to Twitch IRC
📺 Monitoring channel: #yourchannel
🌐 Widget available at: http://localhost:3000/widget.html
```

## Step 6: Test the Widget

1. Open browser: **http://localhost:3000/widget.html**
2. You should see the campfire with test users
3. Open your Twitch chat
4. Type: `!join`
5. You should appear around the campfire!

## Step 7: Add to OBS

1. In OBS/Streamlabs, add a **Browser Source**
2. URL: `http://localhost:3000/widget.html`
3. Width: `1920` Height: `1080`
4. ✅ Check "Shutdown source when not visible"
5. ✅ Check "Refresh browser when scene becomes active"

## Step 8: Stream!

1. Keep `server.js` running (don't close terminal)
2. Start your stream
3. When viewers type `!join` in chat, they appear!
4. Chat messages (under 50 chars) show above sprites

---

## Troubleshooting

### "Cannot find module 'express'"
**Fix:** Run `npm install` again

### "Connection failed" or "Authentication failed"
**Fix:** 
- Check your OAuth token is correct
- Make sure you selected `chat:read` scope
- Token might be expired - generate a new one

### "Channel not found"
**Fix:** 
- Make sure `CHANNEL_NAME` is correct (lowercase, no spaces)
- Channel must exist and be accessible

### Widget shows but no chat messages
**Fix:**
- Make sure server is running (`npm start`)
- Check browser console for errors
- Verify you're typing in the correct Twitch channel

### Widget is blank
**Fix:**
- Open browser console (F12)
- Check for JavaScript errors
- Make sure `widget.html` loads correctly

---

## Commands

- `!join` or `!campfire` - Join the campfire
- Any message under 50 characters - Shows above your sprite

---

## Next Steps

Once the MVP is working:
1. Customize settings in dashboard: `http://localhost:3000/dashboard.html`
2. Upload custom sprites
3. Adjust glow, size, and other settings
4. See `IMPLEMENTATION_PLAN.md` for full feature roadmap

---

## Need Help?

Check:
- `IMPLEMENTATION_PLAN.md` - Full implementation details
- `CHAT_INTEGRATION.md` - Chat integration examples
- `README.md` - General documentation
