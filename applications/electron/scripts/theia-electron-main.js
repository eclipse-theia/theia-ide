const path = require('path');
const fs = require('fs');
const os = require('os');
const { copyBundledPlugins } = require('./appimage-helpers');

// Update to override the supported VS Code API version.
// process.env.VSCODE_API_VERSION = '1.50.0'

// Detect if running as AppImage
const isAppImage = !!process.env.APPIMAGE;

// When packaged with asar, __dirname is inside app.asar (e.g., .../app.asar/scripts)
// but plugins are in extraResources at .../app/plugins (outside the asar)
const isInsideAsar = __dirname.includes('.asar');
const bundledPluginsDir = isInsideAsar
    ? path.join(process.resourcesPath, 'app', 'plugins')
    : path.resolve(__dirname, '../', 'plugins');

if (isAppImage) {
    // When running as AppImage, use a user-writable directory for the built-in plugins
    // The AppImage mount point (/tmp/.mount_*) is read-only
    const configDir = process.env.THEIA_CONFIG_DIR || path.join(os.homedir(), '.theia-ide');
    const userPluginsDir = path.join(configDir, 'builtInPlugins');
    const packageJsonPath = path.resolve(__dirname, '../', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;

    // Copy bundled plugins to user directory if needed (first run or version update)
    const useUserDir = copyBundledPlugins(bundledPluginsDir, userPluginsDir, currentVersion);
    // If copying fails, fall back to the read-only bundled directory (will be improved in follow up of GH-630)
    process.env.THEIA_DEFAULT_PLUGINS = `local-dir:${useUserDir ? userPluginsDir : bundledPluginsDir}`;

} else {
    // Use a set of builtin plugins in our application.
    process.env.THEIA_DEFAULT_PLUGINS = `local-dir:${bundledPluginsDir}`;
}

// Handover to the auto-generated electron application handler.
require('../lib/backend/electron-main.js');
