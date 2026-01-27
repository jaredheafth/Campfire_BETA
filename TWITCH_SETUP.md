# Twitch Channel Integration Setup

This guide will help you connect the Campfire Widget to your Twitch channel for real-time chat integration.

## Prerequisites

- A Twitch account
- Node.js installed (already done if you've been running the server)
- The server running (`node server.js`)

## Step 1: Get Your Twitch OAuth Token

1. **Go to Twitch Token Generator**: https://twitchtokengenerator.com/
   
2. **Select Scopes**:
   - ✅ `chat:read` - Required to read chat messages
   - ✅ `channel:moderate` - Optional, but helpful for mod features
   
3. **Click "Generate Token"**
   
4. **Copy the OAuth Token** - It will look like: `oauth:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   
   ⚠️ **Important**: Keep this token private! Never share it publicly or commit it to GitHub.

## Step 2: Update Server Configuration

1. **Open `server.js`** in your code editor

2. **Find the CONFIG section** (around line 25):

```javascript
const CONFIG = {
    BOT_USERNAME: 'YOUR_TWITCH_USERNAME',
    OAUTH_TOKEN: 'oauth:YOUR_OAUTH_TOKEN_HERE',
    CHANNEL_NAME: 'YOUR_CHANNEL_NAME'
};
```

3. **Update with your information**:
   - `BOT_USERNAME`: Your Twitch username (the account that will connect to chat)
   - `OAUTH_TOKEN`: The OAuth token you copied from Step 1
   - `CHANNEL_NAME`: Your Twitch channel name (without the `#`)

**Example**:
```javascript
const CONFIG = {
    BOT_USERNAME: 'jaredheath',
    OAUTH_TOKEN: 'oauth:abc123xyz789...',
    CHANNEL_NAME: 'jaredheath'
};
```

## Step 3: Start the Server

1. **Make sure you're in the project directory**:
   ```bash
   cd /Users/jaredheath/Sidedesk/xCODING/Cursor/!IDEAS/idea_SLOBS_Widget_Campfire
   ```

2. **Start the server**:
   ```bash
   node server.js
   ```

3. **Look for success messages**:
   ```
   ✅ Connected to Twitch IRC: [address]:[port]
   📺 Monitoring channel: #yourchannel
   ```

   If you see these messages, you're connected! 🎉

## Step 4: Test the Integration

1. **Open your Twitch channel** in a browser (or use another account)

2. **Open the widget** in OBS or browser:
   - Widget URL: `http://localhost:3000/widget.html`
   - Or add as Browser Source in OBS

3. **Test the join command**:
   - Type `!join` in your Twitch chat
   - You should see yourself appear around the campfire!

4. **Test chat messages**:
   - Type any message under 50 characters
   - It should appear above your sprite

## Step 5: Configure Join Settings

1. **Open the Dashboard**: `http://localhost:3000/dashboard.html`

2. **Go to the "Join" tab**

3. **Configure your join method**:
   - **Command**: Users type `!join` (or your custom command)
   - **Emote**: Users use a specific emote
   - **Cheer/Payment**: Users must cheer bits or gift subs

4. **Set restrictions** (optional):
   - Subscriber only
   - Tier 2/3 subs only
   - VIP only
   - Prime only

5. **Click "Save"** - Settings are automatically synced to the server

## Troubleshooting

### Server won't connect to Twitch

**Check your credentials**:
- Make sure `BOT_USERNAME` matches your Twitch username exactly (case-sensitive)
- Verify `OAUTH_TOKEN` starts with `oauth:` and is complete
- Ensure `CHANNEL_NAME` is your channel name without `#`

**Check the console**:
- Look for error messages in the server console
- Common errors:
  - `Login authentication failed` → Invalid OAuth token (may have expired)
  - `No response from Twitch` → Check your internet connection
  - `Channel not found` → Verify channel name spelling

### Widget not showing users

**Check server connection**:
- Open browser console (F12) on the widget page
- Look for errors fetching `/api/events`
- Make sure server is running on port 3000

**Check server logs**:
- You should see messages like: `💬 [#channel] username: message`
- If you don't see these, Twitch connection isn't working

### OAuth Token Expired

OAuth tokens can expire. If you get authentication errors:

1. Go back to https://twitchtokengenerator.com/
2. Generate a new token
3. Update `OAUTH_TOKEN` in `server.js`
4. Restart the server

## Security Notes

⚠️ **Important Security Tips**:

1. **Never commit your OAuth token to Git**
   - Add `server.js` to `.gitignore` if it contains your token
   - Or use environment variables (see below)

2. **Use Environment Variables** (Recommended for production):
   
   Create a `.env` file:
   ```
   TWITCH_BOT_USERNAME=your_username
   TWITCH_OAUTH_TOKEN=oauth:your_token
   TWITCH_CHANNEL=your_channel
   ```
   
   Then use `dotenv` package:
   ```bash
   npm install dotenv
   ```
   
   Update `server.js`:
   ```javascript
   require('dotenv').config();
   const CONFIG = {
       BOT_USERNAME: process.env.TWITCH_BOT_USERNAME,
       OAUTH_TOKEN: process.env.TWITCH_OAUTH_TOKEN,
       CHANNEL_NAME: process.env.TWITCH_CHANNEL
   };
   ```

3. **Rotate tokens regularly** - Generate new tokens every few months

## Next Steps

Once connected, you can:

- ✅ Test with real viewers in your stream
- ✅ Adjust join settings based on your community
- ✅ Customize sprites and campfire graphics
- ✅ Share the viewer dashboard link with your community

## Viewer Dashboard Link

Share this link with your viewers so they can customize their sprites:
```
http://localhost:3000/viewer-dashboard.html
```

(For production, replace `localhost:3000` with your actual server URL)

## Need Help?

Check the console logs for detailed error messages. The server will tell you exactly what's wrong if something isn't configured correctly.
