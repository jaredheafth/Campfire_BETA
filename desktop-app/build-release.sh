#!/bin/bash
# build-release.sh - Automated build and release preparation for Desktop App

set -e  # Exit on error

VERSION=${1:-"1.0.0"}
echo "🔥 Building Campfire Widget Desktop App v$VERSION"
echo "=================================================="
echo ""

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Update version in package.json
echo "📝 Updating version to $VERSION..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
else
    # Linux
    sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
fi

# Sync server files
echo ""
echo "📁 Syncing server files..."
chmod +x setup.sh
./setup.sh

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..

# Build installers
echo ""
echo "🔨 Building installers..."
echo "   This may take a few minutes..."
echo ""

# Build Windows
echo "   Building Windows installer..."
npm run build:win || {
    echo "❌ Windows build failed!"
    exit 1
}

# Build Mac
echo ""
echo "   Building Mac installer..."
npm run build:mac || {
    echo "❌ Mac build failed!"
    exit 1
}

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Installers are in: dist/"
echo "   - Windows: Campfire Widget Setup $VERSION.exe"
echo "   - Mac: Campfire Widget-$VERSION.dmg"
echo ""
echo "📋 Next steps:"
echo "   1. Test the installers on clean machines"
echo "   2. Create git tag: git tag -a v$VERSION -m 'Release v$VERSION'"
echo "   3. Push tag: git push origin v$VERSION"
echo "   4. Create GitHub Release and upload installers from dist/"
echo ""
echo "📖 See GITHUB_RELEASES_GUIDE.md for detailed instructions"
