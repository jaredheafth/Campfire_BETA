# 🚀 GitHub Release Guide - Step by Step

Complete guide for releasing new versions of the Campfire Widget desktop app on GitHub.

## 📋 Pre-Release Checklist

Before creating a release, make sure:

- ✅ All code changes are committed and pushed
- ✅ Version number is updated in `desktop-app/package.json`
- ✅ Installers are built and tested
- ✅ Installers are copied to `releases/` folder
- ✅ Release notes are prepared

---

## 🔢 Step 1: Update Version Number

1. **Open** `desktop-app/package.json`
2. **Change** the version:
   ```json
   "version": "0.0.1",  // Update to new version
   ```
3. **Save** the file

**Current version:** `0.0.1`

---

## 🔨 Step 2: Sync Server Files

Run the setup script to ensure all latest files are copied:

```bash
cd desktop-app
./setup.sh    # Mac/Linux
# OR
setup.bat     # Windows
```

This copies:
- Server files (`server.js`, `dashboard.html`, `widget.html`, etc.)
- Sprite files (default sprites)

---

## 📦 Step 3: Build Installers

Build the installers for all platforms:

### Option A: Build Both (Recommended)
```bash
cd desktop-app
npm run build:win    # Windows installer
npm run build:mac    # Mac installers (Intel + Apple Silicon)
```

### Option B: Build One Platform
```bash
cd desktop-app
npm run build:win -- --publish never    # Windows only
npm run build:mac -- --publish never    # Mac only
```

**Output files:**
- Windows: `desktop-app/dist/Campfire Widget Setup 0.0.1.exe`
- Mac Intel: `desktop-app/dist/Campfire Widget-0.0.1.dmg`
- Mac Apple Silicon: `desktop-app/dist/Campfire Widget-0.0.1-arm64.dmg`

---

## 📁 Step 4: Copy Installers to Releases Folder

Copy the new installers to the `releases/` folder:

```bash
# From project root
rm -f releases/*.{exe,dmg}                    # Remove old installers (optional)
cp desktop-app/dist/*.{exe,dmg} releases/     # Copy new installers
```

**Verify installers:**
```bash
ls -lh releases/
```

You should see:
- `Campfire Widget Setup 0.0.1.exe` (Windows)
- `Campfire Widget-0.0.1.dmg` (Mac Intel)
- `Campfire Widget-0.0.1-arm64.dmg` (Mac Apple Silicon)

---

## 📝 Step 5: Commit Changes

Commit the version update and new installers:

```bash
# From project root
git add desktop-app/package.json releases/
git commit -m "Bump version to 0.0.1 and add installers

- Updated version in package.json
- Built Windows installer (Campfire Widget Setup 0.0.1.exe)
- Built Mac Intel installer (Campfire Widget-0.0.1.dmg)
- Built Mac Apple Silicon installer (Campfire Widget-0.0.1-arm64.dmg)
- All installers include auto-updater support"
git push origin main
```

---

## 🏷️ Step 6: Create GitHub Release

### 6.1. Go to GitHub Releases

1. **Open** your GitHub repo: `https://github.com/jaredheafth/offlineclub_widget_Campfire`
2. **Click** "Releases" (on the right sidebar)
3. **Click** "Draft a new release" (or "Create a new release")

### 6.2. Fill in Release Details

**Choose a tag:**
- **Tag version:** `v0.0.1` (must match version number)
- **Create new tag:** `v0.0.1` on publish
- **Target:** `main` branch

**Release title:**
```
v0.0.1 - Beta Release with Auto-Updater
```

**Description:**
```markdown
## 🔥 Campfire Widget v0.0.1

### ✨ What's New
- Auto-updater support - check for updates from the dashboard
- Improved installer - updates over existing installations
- All fixes from previous versions

### 📦 Downloads

**Windows:**
- Download `Campfire Widget Setup 0.0.1.exe`
- Run the installer
- Follow the installation wizard

**Mac Intel:**
- Download `Campfire Widget-0.0.1.dmg`
- Open the DMG file
- Drag to Applications folder

**Mac Apple Silicon (M1/M2/M3):**
- Download `Campfire Widget-0.0.1-arm64.dmg`
- Open the DMG file
- Drag to Applications folder

### 🆕 Auto-Updater

The app now includes an auto-updater that:
- Checks for updates on startup
- Checks every 4 hours automatically
- Shows notifications when updates are available
- Downloads and installs updates with one click

### 🐛 Bug Fixes
- Fixed sprite loading on Windows
- Fixed OAuth token generation
- Improved installer update behavior

### ⚠️ Known Issues
- This is a beta/pre-release version
- Some features may be incomplete
- Report issues on GitHub

### 📋 Installation Notes
- Installers can update over existing installations
- User data (settings, sprites) is preserved during updates
- Requires Windows 10+ or macOS 10.12+

---

**Full Changelog:** [See commit history](https://github.com/jaredheafth/offlineclub_widget_Campfire/compare/v0.0.0...v0.0.1)
```

### 6.3. Upload Installers

**Drag and drop** the installers from `releases/` folder:
1. **Click** "Attach binaries by dropping them here"
2. **Drag** these 3 files:
   - `Campfire Widget Setup 0.0.1.exe`
   - `Campfire Widget-0.0.1.dmg`
   - `Campfire Widget-0.0.1-arm64.dmg`
3. **Wait** for uploads to complete (they're large files, ~70-95MB each)

### 6.4. Publish Release

**Before publishing, check:**
- ✅ Tag is correct (`v0.0.1`)
- ✅ Title and description are correct
- ✅ All 3 installers are attached
- ✅ Release type is correct (Release, not Pre-release)

**Click** "Publish release"

---

## ✅ Step 7: Verify Release

After publishing:

1. **Check** the release page: `https://github.com/jaredheafth/offlineclub_widget_Campfire/releases/tag/v0.0.1`
2. **Verify** installers are downloadable
3. **Test** downloading and installing one installer
4. **Test** auto-updater (if updating from v0.0.0)

---

## 🔄 Step 8: Auto-Updater Testing (Optional)

To test the auto-updater:

1. **Install** v0.0.0 from previous release
2. **Open** the app
3. **Wait** 5 seconds (check happens automatically)
4. **Check** dashboard header for update notification
5. **Click** "Download Update" (if available)
6. **Click** "Install & Restart" when ready

The auto-updater will:
- Check GitHub Releases for `latest.yml`
- Compare versions
- Download and install if newer version found

---

## 📊 Release Summary Template

For future releases, use this template:

```markdown
## 🔥 Campfire Widget v[X.X.X]

### ✨ What's New
- Feature 1
- Feature 2
- Bug fix

### 🐛 Bug Fixes
- Fixed issue 1
- Fixed issue 2

### 📦 Downloads
- Windows: `Campfire Widget Setup [X.X.X].exe`
- Mac Intel: `Campfire Widget-[X.X.X].dmg`
- Mac Apple Silicon: `Campfire Widget-[X.X.X]-arm64.dmg`

### 📋 Installation Notes
- Installers can update over existing installations
- User data is preserved during updates
- Requires Windows 10+ or macOS 10.12+
```

---

## 🎯 Quick Release Command Summary

```bash
# 1. Update version
# Edit desktop-app/package.json: "version": "0.0.1"

# 2. Sync files
cd desktop-app && ./setup.sh && cd ..

# 3. Build installers
cd desktop-app
npm run build:win -- --publish never
npm run build:mac -- --publish never
cd ..

# 4. Copy to releases
rm -f releases/*.{exe,dmg}
cp desktop-app/dist/*.{exe,dmg} releases/

# 5. Commit
git add desktop-app/package.json releases/
git commit -m "Bump version to 0.0.1 and add installers"
git push origin main

# 6. Create GitHub Release (manual steps)
# - Go to GitHub Releases
# - Create new release with tag v0.0.1
# - Upload installers from releases/ folder
# - Publish release
```

---

## ❓ Troubleshooting

### Installers don't build
- Make sure `npm install` was run in `desktop-app/`
- Check that `setup.sh` copied all files correctly
- Verify Node.js version (should be 16+)

### GitHub Release fails
- Make sure tag format is correct (`v0.0.1` with 'v' prefix)
- Check that installers are actually in `releases/` folder
- Verify file sizes are reasonable (70-100MB)

### Auto-updater doesn't work
- Ensure GitHub Release has installers attached
- Check that `latest.yml` was generated (should be automatic)
- Verify version number matches tag (`v0.0.1` = version `0.0.1`)

---

## 📚 Additional Resources

- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [electron-updater Documentation](https://www.electron.build/auto-update.html)
- [Semantic Versioning](https://semver.org/)

---

## ✅ Release Checklist

Use this checklist for each release:

- [ ] Update version in `desktop-app/package.json`
- [ ] Run `setup.sh` to sync files
- [ ] Build Windows installer
- [ ] Build Mac installers
- [ ] Copy installers to `releases/` folder
- [ ] Commit and push changes
- [ ] Create GitHub Release with tag `v[X.X.X]`
- [ ] Write release notes
- [ ] Upload all 3 installers
- [ ] Publish release
- [ ] Test auto-updater (if applicable)
- [ ] Announce release (if applicable)

---

**Happy releasing! 🎉**
