# ✅ Release Checklist - Desktop App & Railway Hosting

## Overview

Both distribution options are now ready:
1. **Desktop App** - Downloadable installer via GitHub Releases
2. **Railway Hosted** - Web-based, always-available solution

---

## Part 1: Desktop App Release

### Pre-Build Checklist

- [x] Server files synced (`setup.sh` / `setup.bat` run)
- [x] Latest code fixes included (rotateY, layering, sprites, etc.)
- [x] Build configuration ready (`package.json`)
- [x] Build scripts created (`build-release.sh`)
- [x] Documentation complete

### Build Steps

- [ ] **Update version** in `desktop-app/package.json` (currently 1.0.0)
- [ ] **Run build script:**
  ```bash
  cd desktop-app
  ./build-release.sh 1.0.0
  ```
- [ ] **Verify installers created** in `desktop-app/dist/`:
  - [ ] `Campfire Widget Setup 1.0.0.exe` (Windows)
  - [ ] `Campfire Widget-1.0.0.dmg` (Mac)

### Testing

- [ ] **Test Windows installer:**
  - [ ] Install on clean Windows machine/VM
  - [ ] Verify app launches
  - [ ] Verify server starts automatically
  - [ ] Verify dashboard opens
  - [ ] Verify widget displays at `http://localhost:3000/widget.html`
  - [ ] Test Twitch integration

- [ ] **Test Mac installer:**
  - [ ] Install on clean Mac machine/VM
  - [ ] Verify app launches
  - [ ] Verify server starts automatically
  - [ ] Verify dashboard opens
  - [ ] Verify widget displays at `http://localhost:3000/widget.html`
  - [ ] Test Twitch integration

### GitHub Release

- [ ] **Create git tag:**
  ```bash
  git tag -a v1.0.0 -m "Release v1.0.0 - Desktop app"
  git push origin v1.0.0
  ```

- [ ] **Create GitHub Release:**
  - [ ] Go to GitHub → Releases → Create new release
  - [ ] Select tag `v1.0.0`
  - [ ] Title: `Campfire Widget v1.0.0 - Desktop App`
  - [ ] Description: Copy from `GITHUB_RELEASES_GUIDE.md` template
  - [ ] Upload `Campfire Widget Setup 1.0.0.exe`
  - [ ] Upload `Campfire Widget-1.0.0.dmg`
  - [ ] Mark as "Latest release" (if first release)
  - [ ] Publish release

- [ ] **Verify release:**
  - [ ] Release page loads correctly
  - [ ] Download links work
  - [ ] Release notes display properly

---

## Part 2: Railway Hosting Setup

### Pre-Deployment Checklist

- [x] `server.js` updated for Railway (env vars, CORS, PORT)
- [x] `railway.json` created
- [x] `.railwayignore` created
- [x] Documentation complete (`RAILWAY_HOSTING_GUIDE.md`)

### Deployment Steps

- [ ] **Push code to GitHub** (if not already):
  ```bash
  git add .
  git commit -m "Prepare for Railway deployment"
  git push origin main
  ```

- [ ] **In Railway Dashboard:**
  - [ ] Create new project
  - [ ] Deploy from GitHub repo
  - [ ] Select your repository
  - [ ] Railway auto-detects Node.js

- [ ] **Set Environment Variables:**
  - [ ] `TWITCH_BOT_USERNAME` = your bot username
  - [ ] `TWITCH_OAUTH_TOKEN` = oauth:your_token (include 'oauth:' prefix)
  - [ ] `TWITCH_CHANNEL_NAME` = your channel name
  - [ ] `NODE_ENV` = production

- [ ] **Deploy:**
  - [ ] Railway builds automatically
  - [ ] Wait for deployment to complete
  - [ ] Get public URL: `https://your-app.railway.app`

### Testing Railway Deployment

- [ ] **Test Dashboard:**
  - [ ] Visit `https://your-app.railway.app/dashboard.html`
  - [ ] Verify dashboard loads
  - [ ] Test settings configuration
  - [ ] Verify widget code generation

- [ ] **Test Widget:**
  - [ ] Visit `https://your-app.railway.app/widget.html`
  - [ ] Verify widget displays correctly
  - [ ] Test in OBS Browser Source

- [ ] **Test Viewer Dashboard:**
  - [ ] Visit `https://your-app.railway.app/viewer-dashboard.html`
  - [ ] Verify viewer dashboard loads
  - [ ] Test sprite selection
  - [ ] Test join functionality

- [ ] **Test Twitch Integration:**
  - [ ] Verify Twitch chat connection
  - [ ] Test `!join` command
  - [ ] Verify users appear in widget
  - [ ] Test member management

### Update Documentation

- [ ] **Update README.md** with both options:
  - [ ] Desktop app download link
  - [ ] Railway hosted URL
  - [ ] Instructions for both

- [ ] **Create user guide** explaining:
  - [ ] When to use desktop app vs hosted
  - [ ] Setup instructions for each

---

## Part 3: Final Steps

### Documentation

- [ ] **Update main README.md:**
  - [ ] Add "Download Desktop App" section
  - [ ] Add "Use Hosted Version" section
  - [ ] Link to both options

- [ ] **Create comparison guide:**
  - [ ] Desktop app vs hosted comparison
  - [ ] Which to choose guide

### Announcement

- [ ] **Prepare announcement:**
  - [ ] Desktop app available on GitHub Releases
  - [ ] Hosted version available at Railway URL
  - [ ] Feature highlights
  - [ ] Setup instructions

- [ ] **Share with users:**
  - [ ] GitHub release announcement
  - [ ] Social media posts
  - [ ] Community announcements

---

## Quick Reference

### Desktop App
- **Build:** `cd desktop-app && ./build-release.sh 1.0.0`
- **Installers:** `desktop-app/dist/`
- **Release Guide:** `GITHUB_RELEASES_GUIDE.md`

### Railway Hosting
- **Deploy:** Railway Dashboard → Deploy from GitHub
- **Guide:** `RAILWAY_HOSTING_GUIDE.md`
- **URL Format:** `https://your-app.railway.app`

---

## Status

- ✅ **Desktop App:** Ready to build
- ✅ **Railway Hosting:** Ready to deploy
- ✅ **Documentation:** Complete
- ✅ **Scripts:** Ready

**Next:** Build desktop app, then deploy to Railway! 🚀
