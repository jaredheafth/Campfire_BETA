# 🎨 Sprite Sheet to Animated GIF Converter

This tool converts horizontal sprite sheet PNGs into animated GIFs.

## Quick Start

### 1. Install Dependencies

```bash
npm install sharp gifencoder canvas
```

### 2. Convert a Sprite Sheet

```bash
node sprite-to-gif.js sprite-sheet.png output.gif
```

Or use the npm script:
```bash
npm run sprite-to-gif sprite-sheet.png output.gif
```

## Usage

### Basic Usage
```bash
node sprite-to-gif.js <input.png> [output.gif]
```

If you don't specify an output file, it will create a `.gif` file with the same name as the input.

### With Options
```bash
node sprite-to-gif.js sprite-sheet.png animation.gif --frames 7 --delay 150
```

### Options

- `--frames N` - Number of frames in the sprite sheet (auto-detected if not specified)
- `--delay N` - Delay between frames in milliseconds (default: 100)
- `--width N` - Width of each sprite frame (auto-detected if not specified)
- `--height N` - Height of each sprite frame (auto-detected if not specified)

## Examples

### Example 1: Auto-detect everything
```bash
node sprite-to-gif.js ninja-sprites.png
```
The tool will try to auto-detect the number of frames and their size.

### Example 2: Specify frame count
```bash
node sprite-to-gif.js ninja-sprites.png ninja-walk.gif --frames 7
```

### Example 3: Custom timing
```bash
node sprite-to-gif.js ninja-sprites.png ninja-walk.gif --frames 7 --delay 200
```
This creates a slower animation (200ms per frame).

### Example 4: Process multiple files
```bash
for file in sprites/*.png; do
    node sprite-to-gif.js "$file"
done
```

## How It Works

1. **Reads the sprite sheet PNG** - Gets dimensions and metadata
2. **Auto-detects frames** - Divides the width by common frame counts (7, 8, 6, etc.)
3. **Extracts each frame** - Crops each sprite from the horizontal sheet
4. **Creates animated GIF** - Combines frames with specified delay
5. **Loops forever** - The GIF repeats continuously

## Sprite Sheet Format

The tool expects **horizontal sprite sheets** where frames are arranged left-to-right:

```
[Frame 1][Frame 2][Frame 3][Frame 4][Frame 5][Frame 6][Frame 7]
```

All frames should be:
- Same width
- Same height
- Evenly spaced
- No gaps between frames (preferred)

## Tips

- **Frame count**: If auto-detection fails, specify `--frames` manually
- **Timing**: Lower delay (50-100ms) = faster animation, higher delay (200-300ms) = slower
- **Quality**: The GIF quality is set to 10 (good balance). You can modify the script to adjust.
- **File size**: More frames and higher quality = larger files

## Troubleshooting

### "sharp package not found"
```bash
npm install sharp gifencoder canvas
```

### "canvas package not found"
The `canvas` package requires system dependencies:
- **Mac**: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`
- **Windows**: Usually works with npm install
- **Linux**: `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`

### Auto-detection fails
Manually specify frame count:
```bash
node sprite-to-gif.js sprite.png --frames 7
```

### Frames look wrong
Check that your sprite sheet has evenly spaced frames. If frames have different widths, you may need to manually specify `--width`.

## Batch Processing

To convert an entire folder of sprite sheets:

```bash
# Create output directory
mkdir -p gifs

# Convert all PNGs
for file in sprites/*.png; do
    filename=$(basename "$file" .png)
    node sprite-to-gif.js "$file" "gifs/${filename}.gif"
done
```

## Integration with Widget

Once you have your animated GIFs:

1. **Upload to dashboard**: Use the sprite upload feature in the dashboard
2. **Or use URLs**: Host the GIFs online and use URLs
3. **Test in widget**: The sprites will animate automatically in the widget!

---

**Note**: This tool is included in the project for convenience. You can also use external tools like:
- Online converters (ezgif.com, etc.)
- Photoshop/GIMP
- Other sprite animation tools

But this script gives you full control and can be automated! 🔥
