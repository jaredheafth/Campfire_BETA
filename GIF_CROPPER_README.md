# Batch GIF Cropper using gifsicle

A command-line tool for batch cropping animated GIFs while preserving transparency and animation. Uses `gifsicle` (the same tool ezgif.com uses) for reliable, high-quality GIF processing.

## Installation

### 1. Install gifsicle

**macOS:**
```bash
brew install gifsicle
```

**Linux:**
```bash
sudo apt-get install gifsicle
```

**Windows:**
Download from https://www.lcdf.org/gifsicle/ and add to PATH

### 2. Install Node.js dependencies

```bash
npm install
```

## Usage

### Centered Crop (same amount from all sides)

```bash
node gif-crop.js --input "*.gif" --crop "10"
```

This crops 10 pixels from all sides (top, right, bottom, left).

### Specific Side Cropping

```bash
node gif-crop.js --input "*.gif" --crop "10,20,30,40"
```

Format: `top,right,bottom,left`
- Top: 10px
- Right: 20px
- Bottom: 30px
- Left: 40px

### Crop Only One Side

```bash
node gif-crop.js --input "file.gif" --crop "0,0,0,10"
```

This crops only 10px from the left side.

### Custom Output Directory

```bash
node gif-crop.js --input "*.gif" --crop "10" --output "./cropped_gifs"
```

## Examples

```bash
# Crop all GIFs in current directory, 10px from all sides
node gif-crop.js --input "*.gif" --crop "10"

# Crop specific files
node gif-crop.js --input "sprite*.gif" --crop "5,5,5,5"

# Crop only from left and right (centered vertically)
node gif-crop.js --input "*.gif" --crop "0,10,0,10"
```

## Features

- ✅ Preserves animation
- ✅ Preserves transparency
- ✅ Preserves frame delays
- ✅ Batch processing
- ✅ Uses gifsicle (same as ezgif.com)

## Output

Cropped files are saved to a `cropped/` directory (or custom directory if specified) with `_cropped` suffix:
- `sprite.gif` → `cropped/sprite_cropped.gif`
