#!/usr/bin/env node

/**
 * Sprite Sheet to Animated GIF Converter (Simple Version)
 * Uses only sharp and gifencoder - no canvas dependencies
 */

const fs = require('fs');
const path = require('path');

let sharp, gifencoder;
try {
    sharp = require('sharp');
} catch (e) {
    console.error('❌ Error: "sharp" package not found.');
    console.log('📦 Run: npm install sharp gifencoder');
    process.exit(1);
}

try {
    gifencoder = require('gifencoder');
} catch (e) {
    console.error('❌ Error: "gifencoder" package not found.');
    console.log('📦 Run: npm install sharp gifencoder');
    process.exit(1);
}

const { PNG } = require('pngjs');

// Parse command line arguments
const args = process.argv.slice(2);
const inputFile = args[0];
const outputFile = args[1] || inputFile.replace(/\.(png|jpg|jpeg)$/i, '.gif');

const options = {
    frames: null,
    delay: 100
};

for (let i = 2; i < args.length; i++) {
    if (args[i] === '--frames' && args[i + 1]) {
        options.frames = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
        options.delay = parseInt(args[i + 1]);
        i++;
    }
}

if (!inputFile) {
    console.error('❌ Error: No input file specified');
    console.log('\nUsage: node sprite-to-gif-simple.js <input.png> [output.gif] [--frames N] [--delay N]');
    process.exit(1);
}

if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: File not found: ${inputFile}`);
    process.exit(1);
}

async function convertSpriteSheetToGif() {
    try {
        console.log(`📖 Reading sprite sheet: ${inputFile}`);
        
        // Get image metadata
        const metadata = await sharp(inputFile).metadata();
        const totalWidth = metadata.width;
        const totalHeight = metadata.height;
        
        console.log(`   Image dimensions: ${totalWidth}x${totalHeight}`);
        
        // Auto-detect frame count
        let numFrames = options.frames;
        if (!numFrames) {
            // Try common frame counts
            const possibleCounts = [7, 8, 6, 4, 5, 9, 10, 12];
            for (const count of possibleCounts) {
                const testWidth = Math.floor(totalWidth / count);
                if (testWidth > 0 && totalWidth % testWidth === 0) {
                    numFrames = count;
                    break;
                }
            }
            if (!numFrames) {
                numFrames = 7; // Default based on your image
            }
        }
        
        const frameWidth = Math.floor(totalWidth / numFrames);
        const frameHeight = totalHeight;
        
        console.log(`\n🎬 Creating animated GIF with ${numFrames} frames...`);
        console.log(`   Frame size: ${frameWidth}x${frameHeight}`);
        console.log(`   Delay: ${options.delay}ms per frame`);
        
        // Create GIF encoder
        const encoder = new gifencoder(frameWidth, frameHeight);
        encoder.setRepeat(0); // Loop forever
        encoder.setDelay(options.delay);
        encoder.setQuality(10);
        
        // Create output stream
        const outputStream = fs.createWriteStream(outputFile);
        encoder.createReadStream().pipe(outputStream);
        
        encoder.start();
        
        // Extract and add each frame
        for (let i = 0; i < numFrames; i++) {
            const x = i * frameWidth;
            
            // Extract frame using sharp
            const frameBuffer = await sharp(inputFile)
                .extract({ left: x, top: 0, width: frameWidth, height: frameHeight })
                .png()
                .toBuffer();
            
            // Parse PNG to get pixel data
            const png = PNG.sync.read(frameBuffer);
            
            // Create frame data array for gifencoder
            const frameData = [];
            for (let y = 0; y < frameHeight; y++) {
                for (let x = 0; x < frameWidth; x++) {
                    const idx = (frameWidth * y + x) << 2;
                    const r = png.data[idx];
                    const g = png.data[idx + 1];
                    const b = png.data[idx + 2];
                    const a = png.data[idx + 3];
                    
                    // Convert RGBA to RGB (handle transparency)
                    if (a < 255) {
                        // Transparent pixel - use black as background
                        frameData.push(0, 0, 0);
                    } else {
                        frameData.push(r, g, b);
                    }
                }
            }
            
            // Add frame to encoder
            encoder.addFrame(frameData);
            
            process.stdout.write(`\r   Frame ${i + 1}/${numFrames} processed`);
        }
        
        encoder.finish();
        
        console.log(`\n✅ Success! Created: ${outputFile}`);
        const stats = fs.statSync(outputFile);
        console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

convertSpriteSheetToGif();
