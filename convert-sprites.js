#!/usr/bin/env node

/**
 * Simple Sprite Sheet to GIF Converter
 * Uses sharp for image processing and creates GIF frames
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function convertSpriteSheet(inputFile, outputFile, numFrames = 7, delay = 100) {
    try {
        console.log(`\n📖 Processing: ${path.basename(inputFile)}`);
        
        // Get image metadata
        const metadata = await sharp(inputFile).metadata();
        const totalWidth = metadata.width;
        const totalHeight = metadata.height;
        
        const frameWidth = Math.floor(totalWidth / numFrames);
        const frameHeight = totalHeight;
        
        console.log(`   Dimensions: ${totalWidth}x${totalHeight}`);
        console.log(`   Frame size: ${frameWidth}x${frameHeight} (${numFrames} frames)`);
        
        // Extract frames and save as individual PNGs first
        const tempDir = path.join(path.dirname(inputFile), '.temp_frames');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const frameFiles = [];
        for (let i = 0; i < numFrames; i++) {
            const x = i * frameWidth;
            const frameFile = path.join(tempDir, `frame_${i}.png`);
            
            await sharp(inputFile)
                .extract({ left: x, top: 0, width: frameWidth, height: frameHeight })
                .toFile(frameFile);
            
            frameFiles.push(frameFile);
            process.stdout.write(`\r   Extracted frame ${i + 1}/${numFrames}`);
        }
        
        console.log(`\n   Creating GIF...`);
        
        // Use sharp to create animated GIF from frames
        // Sharp can create GIFs by combining images
        const gifBuffer = await sharp({
            create: {
                width: frameWidth,
                height: frameHeight,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        })
        .gif({ 
            delay: delay,
            loop: 0 // 0 = infinite loop
        })
        .toBuffer();
        
        // Actually, sharp doesn't directly support multi-frame GIFs easily
        // Let's use a different approach - create frames and use imagemagick or similar
        // For now, let's create individual frame files and use a web-based approach
        
        // Save frames for now - we'll combine them
        console.log(`   Frames extracted. Creating GIF...`);
        
        // Use sharp to create animated GIF from frames
        // Sharp can create animated GIFs by providing multiple inputs
        const frameBuffers = await Promise.all(
            frameFiles.map(file => sharp(file).toBuffer())
        );
        
        // Create animated GIF using sharp's animation support
        // Combine all frames into a single animated GIF
        const gif = await sharp(frameBuffers[0], {
            animated: true
        })
        .gif({ 
            delay: delay,
            loop: 0  // 0 = infinite loop
        })
        .toBuffer();
        
        // Actually, sharp needs all frames as input for animation
        // Let's use a different approach - create GIF from all frames at once
        const animatedGif = await sharp(frameBuffers, {
            animated: true
        })
        .gif({
            delay: delay,
            loop: 0
        })
        .toBuffer();
        
        // Save the GIF
        fs.writeFileSync(outputFile, animatedGif);
        
        // Clean up temp files
        frameFiles.forEach(file => fs.unlinkSync(file));
        fs.rmdirSync(tempDir);
        
        const stats = fs.statSync(outputFile);
        console.log(`✅ Created: ${path.basename(outputFile)} (${(stats.size / 1024).toFixed(2)} KB)`);
        
        return outputFile;
        
    } catch (error) {
        console.error(`❌ Error processing ${inputFile}:`, error.message);
        throw error;
    }
}

async function main() {
    const spritesDir = path.join(__dirname, 'sprites');
    const pngFiles = fs.readdirSync(spritesDir)
        .filter(file => file.endsWith('.png') && !file.startsWith('.'))
        .map(file => path.join(spritesDir, file));
    
    if (pngFiles.length === 0) {
        console.log('❌ No PNG files found in sprites/ directory');
        return;
    }
    
    console.log(`\n🎬 Found ${pngFiles.length} sprite sheet(s) to convert:\n`);
    
    for (const pngFile of pngFiles) {
        const baseName = path.basename(pngFile, '.png');
        const gifFile = path.join(spritesDir, `${baseName}.gif`);
        
        try {
            // Auto-detect frame count (try 7 first, then 8, 6, etc.)
            const metadata = await sharp(pngFile).metadata();
            const possibleFrames = [7, 8, 6, 4, 5, 9, 10];
            let numFrames = 7; // Default
            
            for (const count of possibleFrames) {
                const testWidth = Math.floor(metadata.width / count);
                if (testWidth > 0 && metadata.width % testWidth === 0) {
                    numFrames = count;
                    break;
                }
            }
            
            await convertSpriteSheet(pngFile, gifFile, numFrames, 150);
        } catch (error) {
            console.error(`Failed to convert ${pngFile}:`, error.message);
        }
    }
    
    console.log(`\n✨ All conversions complete!\n`);
}

main().catch(console.error);
