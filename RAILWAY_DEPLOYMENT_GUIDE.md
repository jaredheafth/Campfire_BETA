# Railway Deployment Guide

## Step 1: Push Code to GitHub

```bash
# Make sure you're on the hosted-platform branch
git checkout hosted-platform

# Add all changes
git add .

# Commit
git commit -m "feat: Prepare for Railway deployment"

# Push to GitHub
git push origin hosted-platform
```

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

## Step 3: Add PostgreSQL Database

1. In your Railway project dashboard, click "New Service"
2. Select "Database" → "PostgreSQL"
3. Wait for it to provision
4. **Important:** The `DATABASE_URL` will be automatically added to your project's environment variables

## Step 4: Configure Environment Variables

Go to your project Settings → Variables and add these:

### Required Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `DATABASE_URL` | (auto-filled from PostgreSQL) | PostgreSQL connection string |
| `JWT_SECRET` | `your-super-secret-jwt-key-min-32-chars` | Secret key for JWT tokens (32+ characters) |
| `TWITCH_CLIENT_ID` | `u4dqiygk2730mgrwd5n29mtvi4xag2` | Twitch OAuth Client ID |
| `TWITCH_CLIENT_SECRET` | `3kffjvwlfgjgeu23k0uco3btvepf94` | Twitch OAuth Client Secret |
| `SESSION_SECRET` | `your-session-secret-key` | Secret for cookie sessions |

### Optional Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `PORT` | `3000` | Port for the server (Railway auto-assigns if not set) |
| `NODE_ENV` | `production` | Set to "production" for production mode |
| `FRONTEND_URL` | `https://your-domain.com` | Your custom domain |
| `RUN_SEEDS` | `false` | Set to `true` only on first deploy to seed data |
| `USE_SQLITE` | `false` | Keep false for Railway (use PostgreSQL) |

## Step 5: Configure Start Command

In Railway project Settings → General:

- **Root Directory:** Leave empty (or set to root)
- **Build Command:** `npm install`
- **Start Command:** `node hosted-server.js`

## Step 6: Deploy

1. Click "Deploy" on your project
2. Watch the build logs for errors
3. Once deployed, Railway will show your public URL

## Step 7: Custom Domain (Optional)

1. Go to project Settings → Domains
2. Click "Generate Domain" for a free railway.app subdomain
3. Or add your own custom domain
4. Update `FRONTEND_URL` environment variable if using custom domain

## Step 8: Verify Deployment

```bash
# Replace with your Railway URL
curl https://your-app.railway.app/api/health
```

Should return:
```json
{
  "status": "ok",
  "database": { "status": "healthy", "database": "connected" }
}
```

## Troubleshooting

### Build Fails

1. Check that `hosted-server.js` exists in the root directory
2. Verify `package.json` has correct dependencies
3. Ensure you're on the `hosted-platform` branch

### Database Connection Failed

1. Verify PostgreSQL service is running
2. Check `DATABASE_URL` is correctly set
3. Ensure SSL is configured for production

### JWT Errors

1. Make sure `JWT_SECRET` is at least 32 characters
2. For production, use a cryptographically secure random string

### Twitch OAuth Not Working

1. Verify Twitch Client ID and Secret are correct
2. Check Redirect URI in Twitch Developer Console is set to:
   - `https://your-app.railway.app/api/auth/twitch/callback`

## Production Checklist

- [ ] PostgreSQL database created
- [ ] All environment variables set
- [ ] Custom domain configured (optional)
- [ ] HTTPS enabled (automatic on Railway)
- [ ] Logs monitored for errors
- [ ] Health check endpoint responding

## Architecture Overview

```
Railway Project
├── Web Service (Node.js/Express)
│   ├── hosted-server.js (main server)
│   ├── API Routes
│   └── WebSocket Server
│
└── PostgreSQL Database
    ├── Users table
    ├── Campfires table
    ├── Buddies table
    └── Messages table
```

## Quick Reference

**Railway Dashboard:** https://railway.app/dashboard

**Useful Commands:**

```bash
# View logs
railway logs

# Open shell
railway shell

# Restart service
railway up
```
