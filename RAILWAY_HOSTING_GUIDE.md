# 🚂 Hosting on Railway - Complete Guide

## Updated Recommendation: **Hosted Web App on Railway**

Since you already have a Railway account, **hosted web app is now the best option**:

### Why Hosted > Desktop App (When You Have Railway)

| Feature | Hosted (Railway) | Desktop App |
|---------|------------------|-------------|
| **User Experience** | ✅ Just add URL to OBS | ⚠️ Download, install, keep running |
| **Always Available** | ✅ 24/7, no user action needed | ❌ User must keep app open |
| **Updates** | ✅ Automatic (you deploy) | ❌ Users download new version |
| **Setup Complexity** | ✅ Zero (just URL) | ⚠️ Installer + keep running |
| **Cost** | ✅ $5-10/month (you pay) | ✅ Free (users run locally) |
| **Professional** | ✅ Very | ✅ Very |
| **Multi-User** | ✅ Yes (one server, many streamers) | ❌ One per user |

**Winner: Hosted on Railway** 🏆

---

## Railway Setup

### Pricing
- **Hobby Plan**: $5/month (includes $5 in credits)
- **Usage-based**: After $5 credit, pay for actual usage
- **Estimated cost**: $5-10/month for a small Node.js server
- **You already have account**: No setup friction!

### What You Need to Host

1. **Node.js Server** (`server.js`)
   - Express server
   - Twitch chat integration (tmi.js)
   - API endpoints (`/api/viewer/join`, `/api/viewer/leave`, etc.)
   - Static file serving

2. **Static Files**
   - `widget.html` - The widget display
   - `dashboard.html` - Streamer dashboard
   - `viewer-dashboard.html` - Viewer customization
   - `sprites/` - Sprite assets

3. **Environment Variables**
   - Twitch OAuth token
   - Channel name
   - Bot username

---

## Step-by-Step Railway Deployment

### 1. Prepare Your Project

Create a `railway.json` or use Railway's auto-detection:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 2. Create `railway.json` (Optional)

Railway auto-detects Node.js, but you can create this for explicit config:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  }
}
```

### 3. Update `server.js` for Railway

Railway provides environment variables. Update your server:

```javascript
// At top of server.js, replace CONFIG with:
const CONFIG = {
    BOT_USERNAME: process.env.TWITCH_BOT_USERNAME || 'YOUR_TWITCH_USERNAME',
    OAUTH_TOKEN: process.env.TWITCH_OAUTH_TOKEN || 'oauth:YOUR_OAUTH_TOKEN',
    CHANNEL_NAME: process.env.TWITCH_CHANNEL_NAME || 'YOUR_CHANNEL_NAME',
    PORT: process.env.PORT || 3000  // Railway sets PORT automatically
};

// Update Express server to use PORT from env:
const PORT = process.env.PORT || 3000;
```

### 4. Update CORS for Production

In `server.js`, update CORS to allow your Railway domain:

```javascript
// Replace the CORS middleware:
const allowedOrigins = [
    'http://localhost:3000',
    process.env.RAILWAY_PUBLIC_DOMAIN,  // Railway provides this
    process.env.WIDGET_DOMAIN  // Your custom domain if you set one
].filter(Boolean);

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
    }
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});
```

### 5. Deploy to Railway

#### Option A: GitHub Integration (Recommended)

1. **Push to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Prepare for Railway deployment"
   git push origin main
   ```

2. **In Railway Dashboard**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway auto-detects Node.js

3. **Set Environment Variables**:
   - Go to your service → Variables tab
   - Add:
     - `TWITCH_BOT_USERNAME` = your bot username
     - `TWITCH_OAUTH_TOKEN` = your OAuth token (get from twitchtokengenerator.com)
     - `TWITCH_CHANNEL_NAME` = your channel name
     - `NODE_ENV` = `production`

4. **Deploy**:
   - Railway automatically builds and deploys
   - Get your public URL (e.g., `https://your-app.railway.app`)

#### Option B: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to existing project or create new
railway link

# Set environment variables
railway variables set TWITCH_BOT_USERNAME=your_username
railway variables set TWITCH_OAUTH_TOKEN=oauth:your_token
railway variables set TWITCH_CHANNEL_NAME=your_channel

# Deploy
railway up
```

### 6. Get Your URLs

After deployment, Railway gives you:
- **Public URL**: `https://your-app.railway.app`
- **Widget URL**: `https://your-app.railway.app/widget.html`
- **Dashboard URL**: `https://your-app.railway.app/dashboard.html`
- **Viewer Dashboard**: `https://your-app.railway.app/viewer-dashboard.html`

### 7. Update Widget Code Generation

In `dashboard.html`, update the widget code to use your Railway URL:

```javascript
// In the code generation function, replace localhost:
const widgetUrl = 'https://your-app.railway.app/widget.html';
// Or use environment variable if you set one
```

---

## User Experience (After Deployment)

### For Streamers:

1. **Go to your dashboard**: `https://your-app.railway.app/dashboard.html`
2. **Configure settings** (campfire graphic, sprites, etc.)
3. **Copy widget code** from Code tab
4. **Add to OBS Browser Source**:
   - URL: `https://your-app.railway.app/widget.html`
   - Width: 1920, Height: 1080
5. **Done!** - Widget works immediately

### For Viewers:

1. **Go to viewer dashboard**: `https://your-app.railway.app/viewer-dashboard.html`
2. **Select sprite** and customize
3. **Click "Join Campfire"**
4. **Type `!join` in chat** (or your command)
5. **Appear around campfire!**

---

## Advantages Over Desktop App

### ✅ For Users:
- **Zero installation** - Just add URL to OBS
- **Always works** - No need to keep app running
- **Automatic updates** - You deploy, users get updates instantly
- **Access from anywhere** - Dashboard works on any device
- **Professional** - Feels like a real product

### ✅ For You:
- **One server, many users** - Can support multiple streamers
- **Easy updates** - Deploy once, everyone gets it
- **Analytics** - Can track usage if you add it
- **Scalable** - Railway handles traffic spikes
- **Low cost** - $5-10/month is very reasonable

---

## Cost Estimate

**Railway Hobby Plan:**
- Base: $5/month (includes $5 credits)
- Node.js server (512MB RAM, 0.5 vCPU): ~$3-5/month
- **Total: ~$5-10/month**

**If you get 10+ users:**
- Still same cost (one server serves all)
- Desktop app: Each user runs their own (free for you, but worse UX)

---

## Custom Domain (Optional)

Railway lets you add a custom domain:

1. **In Railway Dashboard**:
   - Go to your service → Settings → Domains
   - Add custom domain (e.g., `campfire.yourdomain.com`)

2. **Update DNS**:
   - Add CNAME record pointing to Railway

3. **Update URLs**:
   - Use your custom domain in widget code

---

## Monitoring & Logs

Railway provides:
- **Real-time logs** - See server output
- **Metrics** - CPU, memory usage
- **Deployments** - Track deployments
- **Alerts** - Set up notifications

---

## Troubleshooting

### Server won't start:
- Check environment variables are set
- Check logs in Railway dashboard
- Verify `PORT` is used (Railway sets this automatically)

### CORS errors:
- Update CORS middleware to include Railway domain
- Check browser console for specific errors

### Twitch connection fails:
- Verify OAuth token is valid
- Check token hasn't expired
- Verify channel name is correct

### Static files not loading:
- Ensure files are in the repo
- Check file paths in `server.js`
- Verify `express.static` is configured correctly

---

## Next Steps

1. **Deploy to Railway** (follow steps above)
2. **Test everything**:
   - Dashboard loads
   - Widget displays
   - Twitch chat works
   - Viewers can join
3. **Share with users**:
   - Give them the dashboard URL
   - They add widget URL to OBS
   - Done!

---

## Recommendation Summary

**With Railway account: Go with Hosted Web App**

- ✅ Better user experience (just URL, no install)
- ✅ Always available (24/7)
- ✅ Automatic updates
- ✅ Professional feel
- ✅ Low cost ($5-10/month)
- ✅ One server, many users

**Desktop app is still good for:**
- Users who want offline capability
- Users who want full control
- Backup option

But **hosted is better** for most users, especially since you already have Railway!
