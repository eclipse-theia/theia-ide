#!/usr/bin/env node
// @ts-check

/**
 * Generates next icons by recoloring the Theia IDE blue (#00ADEE) to
 * next purple (#8B5CF6), matching the next splash screen color scheme.
 * White text and transparency are preserved.
 *
 * Source: applications/electron/resources/icons/
 * Output: applications/electron-next/resources/icons/
 *
 * Requires ImageMagick (`convert`). Falls back to `sharp` if ImageMagick is not available.
 *
 * Usage: node scripts/generate-next-icons.js
 */

const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const SOURCE_DIR = path.resolve(__dirname, '../applications/electron/resources/icons');
const TARGET_DIR = path.resolve(__dirname, '../applications/electron-next/resources/icons');

const ICON_MAPPINGS = [
    { src: 'LinuxLauncherIcons/512x512.png', dest: 'LinuxLauncherIcons/512x512.png' },
    { src: 'WindowIcon/512-512.png', dest: 'WindowIcon/512-512.png' },
    { src: '512x512.png', dest: '512x512.png' },
];

// Theia blue → next purple (same as splash screen logo)
const THEIA_BLUE = '#00ADEE';
const NEXT_PURPLE = '#8B5CF6';

function hasImageMagick() {
    try {
        child_process.execSync('convert --version', { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

function generateWithImageMagick(srcPath, destPath) {
    const destDir = path.dirname(destPath);
    fs.mkdirSync(destDir, { recursive: true });

    // Replace blue with purple on the RGB data, then re-apply original alpha.
    // The -fuzz 25% catches anti-aliased edge pixels near the blue color.
    const cmd = [
        'convert',
        `\\( "${srcPath}" -alpha off -fuzz 25% -fill "${NEXT_PURPLE}" -opaque "${THEIA_BLUE}" \\)`,
        `\\( "${srcPath}" -alpha extract \\)`,
        '-compose CopyOpacity -composite',
        `"${destPath}"`
    ].join(' ');

    child_process.execSync(cmd, { stdio: 'pipe' });
    console.log(`Generated: ${destPath}`);
}

async function generateWithSharp(srcPath, destPath) {
    const sharp = require('sharp');
    const destDir = path.dirname(destPath);
    fs.mkdirSync(destDir, { recursive: true });

    const { data, info } = await sharp(srcPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const output = Buffer.from(data);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * channels;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Compute saturation (HSV) to distinguish colored vs white pixels
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;

            if (sat > 0.10 && data[i + 3] > 0) {
                // Colored (blue) pixel: replace with next purple
                output[i] = 0x8B;
                output[i + 1] = 0x5C;
                output[i + 2] = 0xF6;
            }
        }
    }

    await sharp(output, { raw: { width, height, channels } })
        .png()
        .toFile(destPath);

    console.log(`Generated: ${destPath}`);
}

async function main() {
    const useImageMagick = hasImageMagick();

    if (!useImageMagick) {
        try {
            require('sharp');
        } catch {
            console.error('Error: Neither ImageMagick nor sharp is available.');
            console.error('Install ImageMagick: sudo apt-get install imagemagick');
            console.error('Or install sharp: npm install sharp');
            process.exit(1);
        }
    }

    console.log(`Using ${useImageMagick ? 'ImageMagick' : 'sharp'} for icon generation`);

    for (const mapping of ICON_MAPPINGS) {
        const srcPath = path.join(SOURCE_DIR, mapping.src);
        const destPath = path.join(TARGET_DIR, mapping.dest);

        if (!fs.existsSync(srcPath)) {
            console.warn(`Warning: Source icon not found: ${srcPath}`);
            continue;
        }

        if (useImageMagick) {
            generateWithImageMagick(srcPath, destPath);
        } else {
            await generateWithSharp(srcPath, destPath);
        }
    }

    console.log('Next icon generation complete!');
}

main().catch(err => {
    console.error('Icon generation failed:', err);
    process.exit(1);
});
