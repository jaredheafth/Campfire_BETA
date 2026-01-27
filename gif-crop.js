#!/usr/bin/env node

/**
 * Batch GIF Cropper using gifsicle
 * 
 * Usage:
 *   node gif-crop.js --input "*.gif" --crop "10"                    # Centered crop (10px from all sides)
 *   node gif-crop.js --input "*.gif" --crop "10,20,30,40"          # Crop: top,right,bottom,left
 *   node gif-crop.js --input "file.gif" --crop "0,0,0,10"          # Crop 10px from left only
 * 
 * Install gifsicle first:
 *   macOS: brew install gifsicle
 *   Linux: sudo apt-get install gifsicle
 *   Windows: Download from https://www.lcdf.org/gifsicle/
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Check if gifsicle is installed
function checkGifsicle() {
    try {
        execSync('gifsicle --version', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

// Parse crop values
function parseCrop(cropString) {
    const parts = cropString.split(',').map(s => parseInt(s.trim()) || 0);
    
    if (parts.length === 1) {
        // Centered crop: same amount from all sides
        return {
            top: parts[0],
            right: parts[0],
            bottom: parts[0],
            left: parts[0]
        };
    } else if (parts.length === 4) {
        // Specific sides: top, right, bottom, left
        return {
            top: parts[0],
            right: parts[1],
            bottom: parts[2],
            left: parts[3]
        };
    } else {
        throw new Error('Crop format must be: "10" (centered) or "10,20,30,40" (top,right,bottom,left)');
    }
}

// Crop a single GIF file
function cropGif(inputPath, outputPath, crop) {
    const { top, right, bottom, left } = crop;
    
    // gifsicle crop syntax: --crop X,Y+WxH
    // We need to calculate: X=left, Y=top, W=original_width-left-right, H=original_height-top-bottom
    
    // First, get GIF dimensions
    try {
        const info = execSync(`gifsicle --info "${inputPath}"`, { encoding: 'utf8' });
        const sizeMatch = info.match(/logical screen (\d+) x (\d+)/);
        
        if (!sizeMatch) {
            throw new Error('Could not determine GIF dimensions');
        }
        
        const originalWidth = parseInt(sizeMatch[1]);
        const originalHeight = parseInt(sizeMatch[2]);
        
        const newWidth = originalWidth - left - right;
        const newHeight = originalHeight - top - bottom;
        
        if (newWidth <= 0 || newHeight <= 0) {
            throw new Error(`Crop values result in invalid dimensions: ${newWidth}x${newHeight}`);
        }
        
        // gifsicle crop: --crop X,Y+WxH
        // X = left, Y = top, W = width, H = height
        const cropString = `${left},${top}+${newWidth}x${newHeight}`;
        
        console.log(`  Cropping: ${originalWidth}x${originalHeight} -> ${newWidth}x${newHeight}`);
        console.log(`  Crop area: left=${left}, top=${top}, width=${newWidth}, height=${newHeight}`);
        
        // Execute gifsicle crop command
        // --crop preserves animation and transparency
        execSync(`gifsicle --crop "${cropString}" "${inputPath}" --output "${outputPath}"`, {
            stdio: 'inherit'
        });
        
        return true;
    } catch (error) {
        console.error(`  ❌ Error cropping ${inputPath}:`, error.message);
        return false;
    }
}

// Main function
function main() {
    const args = process.argv.slice(2);
    
    // Parse arguments
    let inputPattern = null;
    let cropString = null;
    let outputDir = null;
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--input' || args[i] === '-i') {
            inputPattern = args[++i];
        } else if (args[i] === '--crop' || args[i] === '-c') {
            cropString = args[++i];
        } else if (args[i] === '--output' || args[i] === '-o') {
            outputDir = args[++i];
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Batch GIF Cropper using gifsicle

Usage:
  node gif-crop.js --input "*.gif" --crop "10"
  node gif-crop.js --input "*.gif" --crop "10,20,30,40" --output "./cropped"

Options:
  --input, -i    Input file pattern (e.g., "*.gif" or "file.gif")
  --crop, -c     Crop values: "10" (centered) or "10,20,30,40" (top,right,bottom,left)
  --output, -o   Output directory (default: same as input with "_cropped" suffix)
  --help, -h     Show this help

Examples:
  # Crop 10px from all sides (centered)
  node gif-crop.js --input "*.gif" --crop "10"
  
  # Crop specific amounts: top=10, right=20, bottom=30, left=40
  node gif-crop.js --input "*.gif" --crop "10,20,30,40"
  
  # Crop only from left side
  node gif-crop.js --input "file.gif" --crop "0,0,0,10"

Install gifsicle:
  macOS:    brew install gifsicle
  Linux:    sudo apt-get install gifsicle
  Windows: Download from https://www.lcdf.org/gifsicle/
            `);
            process.exit(0);
        }
    }
    
    // Validate arguments
    if (!inputPattern) {
        console.error('❌ Error: --input is required');
        console.log('Use --help for usage information');
        process.exit(1);
    }
    
    if (!cropString) {
        console.error('❌ Error: --crop is required');
        console.log('Use --help for usage information');
        process.exit(1);
    }
    
    // Check if gifsicle is installed
    if (!checkGifsicle()) {
        console.error('❌ Error: gifsicle is not installed or not in PATH');
        console.log('\nInstall gifsicle:');
        console.log('  macOS:   brew install gifsicle');
        console.log('  Linux:   sudo apt-get install gifsicle');
        console.log('  Windows: Download from https://www.lcdf.org/gifsicle/');
        process.exit(1);
    }
    
    // Parse crop values
    let crop;
    try {
        crop = parseCrop(cropString);
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
    
    console.log(`\n🔍 Finding GIF files matching: ${inputPattern}`);
    console.log(`✂️  Crop settings: top=${crop.top}, right=${crop.right}, bottom=${crop.bottom}, left=${crop.left}\n`);
    
    // Find matching files
    const files = glob.sync(inputPattern);
    
    if (files.length === 0) {
        console.error(`❌ No files found matching: ${inputPattern}`);
        process.exit(1);
    }
    
    console.log(`📁 Found ${files.length} file(s)\n`);
    
    // Determine output directory
    if (!outputDir) {
        const firstFileDir = path.dirname(files[0]);
        outputDir = path.join(firstFileDir, 'cropped');
    }
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`📁 Created output directory: ${outputDir}\n`);
    }
    
    // Process each file
    let successCount = 0;
    let failCount = 0;
    
    files.forEach((file, index) => {
        const filename = path.basename(file);
        const nameWithoutExt = path.parse(filename).name;
        const outputPath = path.join(outputDir, `${nameWithoutExt}_cropped.gif`);
        
        console.log(`[${index + 1}/${files.length}] Processing: ${filename}`);
        
        if (cropGif(file, outputPath, crop)) {
            console.log(`  ✅ Saved: ${outputPath}\n`);
            successCount++;
        } else {
            failCount++;
        }
    });
    
    // Summary
    console.log(`\n✅ Completed: ${successCount} successful, ${failCount} failed`);
    if (successCount > 0) {
        console.log(`📁 Output directory: ${outputDir}`);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { cropGif, parseCrop };
