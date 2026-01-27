#!/bin/bash

# Setup script for desktop app
# Copies server files and prepares for building

echo "🔥 Campfire Widget Desktop App Setup"
echo "===================================="
echo ""

# Create server directory if it doesn't exist
mkdir -p server

# Copy server files
echo "📁 Copying server files..."
cp ../server.js server/
cp ../dashboard.html server/
cp ../widget.html server/
cp ../viewer-dashboard.html server/
cp ../package.json server/

# Copy sprite files (if sprites directory exists)
if [ -d "../sprites" ]; then
    echo "📁 Copying sprite files..."
    mkdir -p server/sprites
    cp -r ../sprites/* server/sprites/ 2>/dev/null || true
    echo "✅ Sprite files copied"
    # Verify sprites were copied
    SPRITE_COUNT=$(find server/sprites/defaults -name "*.gif" 2>/dev/null | wc -l | tr -d ' ')
    echo "   Found $SPRITE_COUNT sprite GIF files"
    if [ "$SPRITE_COUNT" -lt 20 ]; then
        echo "   ⚠️  Warning: Expected at least 20 sprite files, found only $SPRITE_COUNT"
    fi
fi

# Create assets directory if it doesn't exist
mkdir -p assets

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add app icons to assets/ folder:"
echo "   - icon.png (512x512) - Fallback"
echo "   - icon.ico (256x256) - Windows"
echo "   - icon.icns (512x512) - Mac"
echo ""
echo "2. Install dependencies:"
echo "   npm install"
echo ""
echo "3. Install server dependencies:"
echo "   cd server && npm install && cd .."
echo ""
echo "4. Build installers:"
echo "   npm run build:win    # Windows"
echo "   npm run build:mac    # Mac"
echo "   npm run build:all    # Both"
echo ""
