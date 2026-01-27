# 🚀 Quick Setup Guide - Campfire Widget

## Streamlabs Custom Widget Method (Easiest - No Hosting Required!)

### Step 1: Configure Settings
1. Open `dashboard.html` in your web browser
2. Configure all your settings:
   - Upload/enter campfire graphic URL
   - Adjust circle angle
   - Set chat command
   - Configure permissions
3. Click **"Save Settings"**

### Step 2: Get the Code
1. Click the **"Widget Code"** tab in the dashboard
2. Click **"Copy Code"** button
3. The entire widget code is now in your clipboard

### Step 3: Add to Streamlabs
1. Go to [Streamlabs Dashboard](https://streamlabs.com/dashboard)
2. Navigate to **All Widgets** → **Custom Widget**
3. Click **"Create New Widget"** (or edit existing)
4. Paste the copied code into the **HTML** section
5. Click **Save**
6. Add the widget to your scene in Streamlabs OBS

### Step 4: Test
- The widget should now appear in your scene
- You'll see test users appear automatically (for testing)
- Adjust settings in the dashboard and regenerate code as needed

---

## Browser Source Method (Alternative)

### Step 1: Host the Files
Upload `widget.html` to a web hosting service:
- **GitHub Pages** (free)
- **Netlify** (free)
- **Vercel** (free)
- Any web server

### Step 2: Get the URL
Copy the public URL to your hosted `widget.html`

### Step 3: Add to Streamlabs OBS
1. In Streamlabs OBS, add a **Browser Source**
2. Paste your widget URL
3. Set dimensions (e.g., 1920x1080)
4. Click **OK**

### Step 4: Configure
1. Open `dashboard.html` locally
2. Configure settings - they'll sync automatically via LocalStorage
3. Refresh the widget to see changes

---

## Custom Widget vs Browser Source

### Custom Widget ✅ (Recommended)
- ✅ No hosting required
- ✅ Code is embedded in Streamlabs
- ✅ Settings embedded in code
- ⚠️ Need to regenerate code to change settings

### Browser Source
- ✅ Easy to update (just refresh)
- ✅ Settings sync via LocalStorage
- ⚠️ Requires web hosting
- ⚠️ Need to keep files online

---

## Troubleshooting

### Widget shows blank/white screen
- Check browser console for errors (F12)
- Verify graphics URL is accessible
- Try the test button in dashboard

### Settings not working
- For Custom Widget: Regenerate code after changing settings
- For Browser Source: Ensure both files on same domain
- Check LocalStorage is enabled in browser

### Graphics not loading
- Verify URL is publicly accessible
- Check file format (GIF, MP4, WebM supported)
- Try a different hosting service (Imgur, Giphy, etc.)

### Need help?
1. Open browser console (F12) to see errors
2. Check that all URLs are correct
3. Verify Streamlabs Custom Widget supports your code
4. Try Browser Source method as alternative

---

## Next Steps

Once the widget is working:
1. **Add Chat Integration**: Connect to Streamlabs/Twitch chat API
2. **Custom Sprites**: Add custom user graphics
3. **Styling**: Customize colors and animations
4. **Effects**: Add sound effects, animations, etc.

See `README.md` for more details!
