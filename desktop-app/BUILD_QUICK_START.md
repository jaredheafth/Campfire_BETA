# 🚀 Quick Start - Building Desktop App

## Fastest Way to Build

```bash
cd desktop-app
chmod +x build-release.sh
./build-release.sh 1.0.0
```

That's it! The script will:
1. ✅ Sync server files
2. ✅ Install dependencies
3. ✅ Build Windows installer
4. ✅ Build Mac installer

Installers will be in `dist/` folder.

---

## Manual Build (Step by Step)

### 1. Sync Files
```bash
cd desktop-app
./setup.sh        # Mac/Linux
# OR
setup.bat         # Windows
```

### 2. Install Dependencies
```bash
npm install
cd server && npm install && cd ..
```

### 3. Build
```bash
npm run build:win    # Windows only
npm run build:mac    # Mac only
npm run build:all    # Both platforms
```

### 4. Find Installers
Look in `dist/` folder:
- Windows: `Campfire Widget Setup 1.0.0.exe`
- Mac: `Campfire Widget-1.0.0.dmg`

---

## Upload to GitHub Releases

1. **Create git tag:**
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

2. **Go to GitHub:**
   - Repository → Releases → Create new release
   - Select tag `v1.0.0`
   - Upload both `.exe` and `.dmg` files from `dist/`
   - Add release notes
   - Publish!

3. **Share the release URL** with users

---

## Troubleshooting

**Build fails?**
- Make sure Node.js is installed: `node --version`
- Try: `npm install` again
- Check that `setup.sh` ran successfully

**Missing icons?**
- Build will still work, just uses default icons
- Add icons to `assets/` folder for branding

**Need help?**
- See `BUILD_INSTRUCTIONS.md` for detailed guide
- See `GITHUB_RELEASES_GUIDE.md` for release process

---

That's it! Your desktop app is ready to distribute! 🎉
