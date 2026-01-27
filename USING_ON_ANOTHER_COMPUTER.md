# 🖥️ Using the Campfire Widget on Another Computer

## Current Setup (Local MVP)

Right now, this widget runs as a **local MVP** that requires:
- A local Node.js server running (`server.js`)
- Access to `localhost:3000` for the dashboard and widget
- Twitch OAuth token for chat access

## Option 1: Copy Files to Another Computer (Same Setup)

### Step 1: Copy the Project Folder
Copy the entire project folder to your other computer (via USB, cloud storage, etc.)

### Step 2: Set Up on New Computer
1. Install Node.js if not already installed
2. Open terminal in the project folder
3. Run: `npm install`
4. Edit `server.js` with your Twitch credentials (see `QUICK_START.md`)
5. Run: `npm start`

### Step 3: Access Dashboard
- Open browser: `http://localhost:3000/dashboard.html`
- Configure your settings
- Copy the widget code from the "Code" tab

### Step 4: Add Widget to OBS
- In Streamlabs OBS, go to: **Dashboard → All Widgets → Custom Widget**
- Create new widget or edit existing
- Paste the code from the dashboard
- Add to your scene

**Note:** The widget code is self-contained and includes all settings, so it works independently once pasted into Streamlabs.

---

## Option 2: Streamlabs Custom Widget (No Server Needed for Widget)

The widget code itself doesn't need a server once pasted into Streamlabs. However:

### What Works Without Server:
- ✅ Widget displays and shows users
- ✅ Settings are embedded in the code
- ✅ Visual effects and animations

### What Requires Server:
- ❌ Real-time chat integration (viewers joining via `!join`)
- ❌ Chat message bubbles
- ❌ Subscriber/VIP status checking

### How to Use:
1. **On your main computer:**
   - Open `dashboard.html` in browser
   - Configure all settings
   - Click "Code" tab
   - Copy the generated code

2. **On your streaming PC:**
   - Open Streamlabs Dashboard → All Widgets → Custom Widget
   - Paste the code
   - Add to scene

3. **For chat integration on streaming PC:**
   - You'd need to run `server.js` on that computer too
   - Or set up a hosted server (see Option 3)

---

## Option 3: Hosted Solution (Production Ready)

For a production setup where you can access the dashboard from anywhere:

### What You'd Need:

1. **Web Hosting** (for dashboard and widget):
   - Host `dashboard.html` and `widget.html` on a web server
   - Options: GitHub Pages, Netlify, Vercel, AWS, etc.

2. **Backend Server** (for chat integration):
   - Host `server.js` on a server (AWS, Heroku, DigitalOcean, etc.)
   - Keep it running 24/7
   - Update CORS settings to allow your widget domain

3. **Twitch OAuth & API Access:**
   - **Yes, you need Twitch authentication** to:
     - Read chat messages
     - Check subscriber status
     - Check VIP/Mod status
     - Verify user permissions

### Twitch Authentication Options:

#### Option A: OAuth Token (Current MVP)
- Get token from: https://twitchtokengenerator.com/
- Scope needed: `chat:read`
- **Limitation:** Token expires, needs manual refresh

#### Option B: Twitch OAuth Flow (Production)
- Register app at: https://dev.twitch.tv/console/apps
- Get Client ID and Client Secret
- Implement OAuth flow in your dashboard
- Users log in with Twitch account
- Dashboard gets access token automatically
- **Better:** Token refreshes automatically

#### Option C: Streamlabs API (If Available)
- Some Streamlabs widgets can access chat without direct Twitch auth
- Check Streamlabs documentation for widget API access
- **Easiest:** If Streamlabs provides chat events to custom widgets

---

## Can It Read Twitch Without Access?

**Short answer: No.**

To read Twitch chat and check subscriber status, you need:
1. **Twitch OAuth token** - Grants permission to read chat
2. **Twitch API access** - To check subscriber/VIP status
3. **Chat connection** - Via Twitch IRC (requires authentication)

**What works without auth:**
- Visual display of the widget
- Mock/test users
- Settings and configuration

**What requires auth:**
- Real chat messages
- Subscriber status
- VIP/Mod status
- User join events from chat

---

## Recommended Approach

### For Testing/Personal Use:
1. Copy project folder to streaming PC
2. Run `npm start` on streaming PC
3. Use `localhost:3000` for dashboard
4. Copy widget code to Streamlabs Custom Widget
5. Keep server running while streaming

### For Production/Public Use:
1. Host dashboard on a web server (accessible from anywhere)
2. Host backend server (for chat integration)
3. Implement Twitch OAuth in dashboard
4. Users log in with Twitch to access dashboard
5. Widget code can be pasted into Streamlabs (works independently)

---

## Quick Setup for Streaming PC

1. **Copy project folder** to streaming PC
2. **Install Node.js** (if not installed)
3. **Open terminal** in project folder
4. **Run:** `npm install`
5. **Edit `server.js`** with your Twitch token
6. **Run:** `npm start`
7. **Open:** `http://localhost:3000/dashboard.html`
8. **Configure settings**
9. **Copy code** from "Code" tab
10. **Paste into Streamlabs** Custom Widget

The widget code is self-contained, so once pasted, it doesn't need the server running (but chat integration will).

---

## Questions?

- See `QUICK_START.md` for local setup
- See `IMPLEMENTATION_PLAN.md` for production roadmap
- See `CHAT_INTEGRATION.md` for API examples
