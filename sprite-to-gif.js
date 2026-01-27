#!/usr/bin/env node

/**
 * Sprite Sheet to Animated GIF Converter
 * 
 * Takes a horizontal sprite sheet PNG and converts it to an animated GIF
 * Usage: node sprite-to-gif.js <input.png> [output.gif] [options]
 * 
 * Options:
 *   --frames N        Number of frames in the sprite sheet (auto-detected if not specified)
 *   --delay N         Delay between frames in milliseconds (default: 100)
 *   --width N         Width of each sprite frame (auto-detected if not specified)
 *   --height N        Height of each sprite frame (auto-detected if not specified)
 */

const fs = require('fs');
const path = require('path');

// Check if required packages are installed
let sharp, gifencoder;
try {
    sharp = require('sharp');
} catch (e) {
    console.error('❌ Error: "sharp" package not found.');
    console.log('📦 Installing required packages...');
    console.log('   Run: npm install sharp gifencoder');
    process.exit(1);
}

try {
    gifencoder = require('gifencoder');
} catch (e) {
    console.error('❌ Error: "gifencoder" package not found.');
    console.log('📦 Installing required packages...');
    console.log('   Run: npm install sharp gifencoder');
    process.exit(1);
}

const { createCanvas, loadImage } = require('canvas');

// Parse command line arguments
const args = process.argv.slice(2);
const inputFile = args[0];
const outputFile = args[1] || inputFile.replace(/\.(png|jpg|jpeg)$/i, '.gif');

// Parse options
const options = {
    frames: null,
    delay: 100,
    width: null,
    height: null
};

for (let i = 2; i < args.length; i++) {
    if (args[i] === '--frames' && args[i + 1]) {
        options.frames = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
        options.delay = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--width' && args[i + 1]) {
        options.width = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--height' && args[i + 1]) {
        options.height = parseInt(args[i + 1]);
        i++;
    }
}

if (!inputFile) {
    console.error('❌ Error: No input file specified');
    console.log('\nUsage: node sprite-to-gif.js <input.png> [output.gif] [options]');
    console.log('\nOptions:');
    console.log('  --frames N    Number of frames (auto-detected if not specified)');
    console.log('  --delay N     Delay between frames in ms (default: 100)');
    console.log('  --width N     Width of each frame (auto-detected if not specified)');
    console.log('  --height N    Height of each frame (auto-detected if not specified)');
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
        
        // Auto-detect frame dimensions if not specified
        let frameWidth = options.width;
        let frameHeight = options.height;
        let numFrames = options.frames;
        
        if (!frameWidth || !frameHeight || !numFrames) {
            // Try to auto-detect: assume frames are evenly spaced horizontally
            // Common sprite sheet patterns: 7 frames, 8 frames, etc.
            const possibleFrameCounts = [7, 8, 6, 4, 5, 9, 10, 12];
            
            for (const count of possibleFrameCounts) {
                const testWidth = Math.floor(totalWidth / count);
                if (testWidth > 0 && totalWidth % testWidth === 0) {
                    frameWidth = testWidth;
                    frameHeight = totalHeight;
                    numFrames = count;
                    console.log(`   Auto-detected: ${numFrames} frames, ${frameWidth}x${frameHeight} each`);
                    break;
                }
            }
            
            // If auto-detection failed, use full width as single frame or ask user
            if (!frameWidth || !numFrames) {
                if (!options.frames) {
                    // Default to 7 frames (based on your image)
                    numFrames = 7;
                    frameWidth = Math.floor(totalWidth / numFrames);
                    frameHeight = totalHeight;
                    console.log(`   Using default: ${numFrames} frames, ${frameWidth}x${frameHeight} each`);
                } else {
                    numFrames = options.frames;
                    frameWidth = Math.floor(totalWidth / numFrames);
                    frameHeight = totalHeight;
                }
            }
        }
        
        console.log(`\n🎬 Creating animated GIF with ${numFrames} frames...`);
        console.log(`   Frame size: ${frameWidth}x${frameHeight}`);
        console.log(`   Delay: ${options.delay}ms per frame`);
        
        // Load the sprite sheet image
        const spriteSheet = await loadImage(inputFile);
        
        // Create GIF encoder
        const encoder = new gifencoder(frameWidth, frameHeight);
        encoder.setRepeat(0); // 0 = loop forever
        encoder.setDelay(options.delay);
        encoder.setQuality(10); // 1-30, lower = better quality but larger file
        
        // Create output stream
        const outputStream = fs.createWriteStream(outputFile);
        encoder.createReadStream().pipe(outputStream);
        
        encoder.start();
        
        // Extract and add each frame
        const canvas = createCanvas(frameWidth, frameHeight);
        const ctx = canvas.getContext('2d');
        
        for (let i = 0; i < numFrames; i++) {
            const x = i * frameWidth;
            
            // Clear canvas
            ctx.clearRect(0, 0, frameWidth, frameHeight);
            
            // Draw the frame from sprite sheet
            ctx.drawImage(
                spriteSheet,
                x, 0, frameWidth, frameHeight,  // Source rectangle
                0, 0, frameWidth, frameHeight  // Destination rectangle
            );
            
            // Add frame to GIF
            encoder.addFrame(ctx);
            
            process.stdout.write(`\r   Frame ${i + 1}/${numFrames} processed`);
        }
        
        encoder.finish();
        
        console.log(`\n✅ Success! Created: ${outputFile}`);
        console.log(`   File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run the conversion
convertSpriteSheetToGif();
