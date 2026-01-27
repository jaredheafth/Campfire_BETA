# 🔧 Auto-Updater 404 Error Fix

## The Problem

When clicking "Check for Updates", you get:
```
Update error: 404
URL: https://github.com/jaredheafth/offlineclub_widget_Campfire/releases.atom
```

## Root Cause

`electron-updater` needs **metadata files** (`latest.yml`, `latest-mac.yml`) to be uploaded to GitHub Releases. These files tell the app:
- What version is available
- Where to download the installer
- File checksums

**The issue**: When you manually upload installers to GitHub Releases, these metadata files aren't included.

## The Solution

### Option 1: Upload Metadata Files Manually (Quick Fix)

After building installers, electron-builder generates metadata files. You need to upload them to GitHub Releases:

1. **Build installers** (already done):
   ```bash
   cd desktop-app
   npm run build:win
   npm run build:mac
   ```

2. **Find metadata files** in `desktop-app/dist/`:
   - `latest.yml` (Windows)
   - `latest-mac.yml` (Mac Intel)
   - `latest-mac-arm64.yml` (Mac Apple Silicon)

3. **Upload to GitHub Release**:
   - Go to your v0.0.2 release
   - Upload these `.yml` files along with the installers
   - They should be in the same release as the installers

### Option 2: Use electron-builder Publish (Automatic)

Instead of manually uploading, use electron-builder's publish feature:

1. **Set GitHub token**:
   ```bash
   export GH_TOKEN=your_github_token
   ```

2. **Build and publish**:
   ```bash
   npm run build:win -- --publish always
   npm run build:mac -- --publish always
   ```

This automatically:
- Builds installers
- Generates metadata files
- Uploads everything to GitHub Releases

### Option 3: Generate Metadata Files Only

If you want to keep manual uploads but generate metadata:

```bash
cd desktop-app
npm run build:win -- --publish never
npm run build:mac -- --publish never
```

Then find the `.yml` files in `dist/` and upload them manually.

## Current Status

The auto-updater is configured correctly in code, but it needs the metadata files on GitHub Releases to work.

## Quick Fix for v0.0.2

1. Check if `latest.yml` files exist in `desktop-app/dist/`
2. If they exist, upload them to the v0.0.2 GitHub Release
3. If they don't exist, rebuild with `--publish never` to generate them

## Verification

After uploading metadata files:
- Click "Check for Updates" in the app
- Should see "Update available: v0.0.2" (not 404 error)
- Can download and install update

---

**Note**: The `releases.atom` 404 is a fallback error. The real issue is missing `latest.yml` files in the GitHub Release.
