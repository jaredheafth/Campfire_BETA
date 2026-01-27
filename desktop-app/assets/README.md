# Icon Assets

This directory should contain the application icons in the following formats:

- **icon.png** (512x512) - Fallback/general purpose icon
- **icon.ico** (256x256) - Windows icon
- **icon.icns** (512x512) - macOS icon

## How to Generate Icons

### Option 1: Using Online Tools
- Visit [icoconvert.com](https://icoconvert.com/) or similar
- Upload a 256x256+ PNG image
- Download as .ico for Windows and .icns for macOS

### Option 2: Using ImageMagick (if installed)
```bash
# Create ICO from PNG
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico

# Create ICNS from PNG (macOS)
sips -s format icns icon.png -o icon.icns
```

### Option 3: Using Python
```python
from PIL import Image
img = Image.open('icon.png').convert('RGBA')
img.save('icon.ico', format='ICO', sizes=[(256, 256)])
```

For now, the build will use placeholder icons. Replace these files before releasing to users.
