# Sprite System Guide

## Folder Structure

The widget now supports multiple sprite modes. Here's where to upload your sprites:

```
sprites/
├── defaults/
│   ├── circles/          # Pixel art circles (colorizable)
│   ├── rpg-characters/   # RPG character sprites (selectable)
│   └── pixel-morphs/     # Custom pixel shapes (colorizable)
└── custom/               # Custom sprites (uploaded by streamer/viewers)
```

## Sprite Modes

### 1. **Pixel Circle** (`circle`)
- **Location**: `sprites/defaults/circles/`
- **How it works**: Upload black/dark pixel art circles
- **Colorization**: Automatically colorized by viewer's Twitch username color
- **Use case**: Simple, clean circles that match viewer colors

### 2. **RPG Characters** (`rpg-characters`)
- **Location**: `sprites/defaults/rpg-characters/`
- **How it works**: Upload multiple RPG character sprites
- **Selection**: Logged-in viewers can choose their character from the viewer dashboard
- **Random assignment**: Non-logged-in viewers get a random character
- **Colorization**: Username takes the viewer's Twitch color (sprite stays original)
- **Use case**: Let viewers pick their favorite character

### 3. **Pixel Morphs** (`pixel-morphs`)
- **Location**: `sprites/defaults/pixel-morphs/`
- **How it works**: Upload custom pixel art shapes (stars, hearts, diamonds, etc.)
- **Colorization**: Automatically colorized by viewer's Twitch username color
- **Use case**: Custom shapes that match viewer colors

### 4. **Custom** (`custom`)
- **Location**: `sprites/custom/`
- **How it works**: Streamer uploads a single sprite OR viewers upload their own
- **Colorization**: Username takes the viewer's Twitch color (sprite stays original)
- **Use case**: Complete customization freedom

## How to Upload Sprites

### Via Dashboard (Recommended)
1. Open the dashboard
2. Go to the **Sprites** tab
3. Select your sprite mode (Circle, RPG Characters, Pixel Morphs, or Custom)
4. Click "Choose Files" and select your sprite(s)
5. Multiple files can be uploaded at once for Circle, RPG, and Morph modes
6. Sprites will appear in a grid - click × to remove any sprite

### Via File System
1. Navigate to the appropriate folder:
   - `sprites/defaults/circles/` for circles
   - `sprites/defaults/rpg-characters/` for RPG characters
   - `sprites/defaults/pixel-morphs/` for morphs
   - `sprites/custom/` for custom sprites
2. Copy your sprite files (PNG, GIF) into the folder
3. Refresh the dashboard - sprites will be detected

## Sprite Requirements

### Format
- **PNG** (recommended for static sprites)
- **GIF** (for animated sprites)

### Size
- Recommended: 40x40px to 80x80px
- The widget will scale sprites based on the "Sprite Size" setting

### Colorization Sprites (Circles & Morphs)
- Must be **black or dark colored**
- Transparent background preferred
- The widget will apply the viewer's Twitch color automatically

### RPG Characters
- Can be any color/style
- Transparent background preferred
- Each file = one character option
- Viewers select from available characters

## What's Been Set Up

✅ **Folder structure created**
✅ **Dashboard updated** with new sprite mode selector
✅ **Multi-file upload** support for Circle, RPG, and Morph modes
✅ **Sprite management** (upload, preview, delete) in dashboard
✅ **Settings storage** in localStorage

## What Still Needs to Be Done

### Widget Updates (Next Steps)
1. **Update `widget.html`** to handle the new sprite modes:
   - Load sprites from localStorage collections
   - Apply colorization for Circle and Morph modes
   - Random assignment for RPG characters (non-logged-in users)
   - Support viewer-selected RPG characters (when logged in)

2. **Update `viewer-dashboard.html`**:
   - Add RPG character selection interface
   - Show available characters when RPG mode is active
   - Save viewer's character choice

3. **Create default circle sprite**:
   - Generate a simple pixel art circle PNG
   - Place it in `sprites/defaults/circles/`
   - This will be the default if no circles are uploaded

## Testing Checklist

- [ ] Upload circle sprites → verify they appear in dashboard
- [ ] Upload RPG sprites → verify they appear in dashboard
- [ ] Upload morph sprites → verify they appear in dashboard
- [ ] Switch between sprite modes → verify correct sections show/hide
- [ ] Delete sprites → verify they're removed from list
- [ ] Test widget with each sprite mode → verify sprites display correctly
- [ ] Test colorization → verify circles/morphs get viewer colors
- [ ] Test RPG character selection → verify viewers can choose characters

## Notes

- Sprites are stored in `localStorage` as base64 data
- Large sprite files (>10MB) may cause issues
- For production, consider hosting sprites on a CDN instead of embedding
- The widget code generation will include sprite data for self-contained widgets
