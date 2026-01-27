# 🖥️ Desktop App Setup Guide

## ✅ Setup Complete!

The server directory structure has been set up. The `desktop-app/server/` directory contains all necessary files.

**Note for Developers**: This setup is a **one-time thing** done before building installers. End users who download the installer won't need to do this - all files are included in the installer package.

### Step 3: Install Dependencies

```bash
cd desktop-app
npm install

cd server
npm install
cd ..
```

### Step 4: Test Locally

```bash
cd desktop-app
npm start
```

This should:
- Start the Electron app
- Automatically start the local server
- Open the dashboard

### Step 5: Build Installers

```bash
cd desktop-app
npm run build:win    # Windows
npm run build:mac    # Mac
```

Installers will be in `desktop-app/dist/`

## File Structure

After setup, your `desktop-app/` should look like:

```
desktop-app/
├── main.js
├── preload.js
├── package.json
├── server/
│   ├── server.js
│   ├── dashboard.html
│   ├── widget.html
│   ├── viewer-dashboard.html
│   └── package.json
├── assets/
│   ├── icon.png (or .ico/.icns)
│   └── tray-icon.png
└── dist/ (after build)
    └── installers...
```

## Local File Handling

The desktop app can serve files from the local computer:

- **Campfire Graphics**: Can be uploaded via dashboard (stored as base64) OR use file:// paths
- **Sprites**: Can be uploaded via dashboard (stored as base64) OR use file:// paths
- **Widget Code**: Self-contained with embedded graphics (no external files needed)

### Using Local Files

When using the widget in OBS:
1. **Option A**: Upload graphics via dashboard (embedded in code)
2. **Option B**: Use `file://` paths (requires OBS to have file access)
3. **Option C**: Host files locally via the desktop app server

## Troubleshooting

### "Server file not found"
- Make sure you copied all files to `desktop-app/server/`
- Check that `server.js` exists in the server directory

### "Cannot find module"
- Run `npm install` in both `desktop-app/` and `desktop-app/server/`
- Make sure `package.json` files are in the right places

### Build fails
- Check Node.js version (should be 16+)
- Try deleting `node_modules` and reinstalling
- Check that all required files exist

## Distribution

Once built, the installers are self-contained:
- Users don't need Node.js installed
- All dependencies are bundled
- Server runs automatically
- Dashboard opens on startup

Users just need to:
1. Download installer
2. Run it
3. Open app from Start Menu/Applications
4. Configure settings
5. Copy widget code to OBS