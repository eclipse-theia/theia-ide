const fs = require('fs');
const path = require('path');

/**
 * Reads the plugin copy metadata file and returns its content.
 * @param metadataPath - Path to the metadata file
 * @returns The metadata object or undefined if not found
 */
function readPluginCopyMetadata(metadataPath) {
    if (!fs.existsSync(metadataPath)) {
        return undefined;
    }
    try {
        return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (err) {
        console.warn('Could not read built-in plugin copy metadata file:', err.message);
        return undefined;
    }
}

/**
 * Writes the plugin copy metadata file with version and timestamp.
 * @param metadataPath - Path to the metadata file
 * @param version - Current version
 */
function writePluginCopyMetadata(metadataPath, version) {
    const metadata = {
        version: version,
        copiedAt: new Date().toISOString()
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, undefined, 2));
}

/**
 * Copies bundled plugins from AppImage to user directory if needed.
 * @param bundledPluginsDir - Path to bundled plugins in AppImage
 * @param userPluginsDir - Path to user built-in plugins directory
 * @param currentVersion - Current Theia IDE version
 * @returns true if the builtins were copied to the user dir, false if there was an error
 */
function copyBundledPlugins(bundledPluginsDir, userPluginsDir, currentVersion) {
    const metadataFile = path.join(userPluginsDir, '.builtInPlugins-metadata');

    // Ensure the user plugins directory exists
    if (!fs.existsSync(userPluginsDir)) {
        fs.mkdirSync(userPluginsDir, { recursive: true });
    }

    // Check if built-in plugins need to be copied
    const metadata = readPluginCopyMetadata(metadataFile);
    let shouldCopy = false;

    if (!metadata) {
        shouldCopy = true;
    } else if (metadata.version !== currentVersion) {
        console.log(`Theia IDE updated from ${metadata.version} to ${currentVersion}. Updating built-in plugins...`);
        shouldCopy = true;
    }

    if (!shouldCopy) {
        console.log('Built-in plugins were already copied.');
        return true;
    }

    console.log(`Copying bundled plugins from AppImage to ${userPluginsDir}...`);
    try {
        // Clean existing plugins directory to remove old/obsolete plugins
        fs.rmSync(userPluginsDir, { recursive: true, force: true });
        fs.mkdirSync(userPluginsDir, { recursive: true });

        const pluginEntries = fs.readdirSync(bundledPluginsDir, { withFileTypes: true });
        for (const entry of pluginEntries) {
            const srcPath = path.join(bundledPluginsDir, entry.name);
            const destPath = path.join(userPluginsDir, entry.name);
            fs.cpSync(srcPath, destPath, { recursive: true });
        }
        writePluginCopyMetadata(metadataFile, currentVersion);
        console.log(`Bundled plugins copied successfully to ${userPluginsDir}.`);
    } catch (err) {
        console.error('Failed to copy bundled plugins:', err.message);
        return false;
    }
    return true;
}

module.exports = {
    copyBundledPlugins,
};
