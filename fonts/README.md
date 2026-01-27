# Fonts Folder

Place your custom font files here. The widget will automatically load fonts from this directory.

## Supported Font Formats
- `.woff2` (recommended - best compression and browser support)
- `.woff` (good fallback)
- `.ttf` (fallback)
- `.otf` (fallback)

## Usage
1. Drop your font file(s) into this folder
2. Name your font file as `username-font` with one of the supported extensions:
   - `username-font.woff2` (recommended)
   - `username-font.woff`
   - `username-font.ttf`
   - `username-font.otf`
3. The font will be automatically loaded and applied to:
   - **Username labels** above user sprites in the widget
   - **Chat bubbles** when testing chat functionality

## Font Loading
The widget will try to load fonts in this order:
1. `username-font.woff2` (best compression)
2. `username-font.woff` (fallback)
3. `username-font.ttf` (fallback)
4. `username-font.otf` (fallback)

If no custom font is found, it will fall back to the system default font.

## Customizing Font Name
If you want to use a different font file name, you can modify the `@font-face` declaration in `widget.html` (around line 8-15).

## Desktop App
For the desktop app, also copy your font file to `desktop-app/server/fonts/` so it's included in the packaged app.
