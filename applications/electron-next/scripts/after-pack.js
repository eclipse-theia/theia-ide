#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Signing and notarizing are not needed for the Next product
// (it is not built on Jenkins as a full release).
// Only the Linux sandbox fix is required for AppImage builds.

// taken and modified from: https://github.com/gergof/electron-builder-sandbox-fix/blob/a2251d7d8f22be807d2142da0cf768c78d4cfb0a/lib/index.js
exports.default = async function (context) {
    if (context.electronPlatformName !== 'linux') {
        return;
    }
    const executable = path.join(
        context.appOutDir,
        context.packager.executableName
    );

    const loaderScript = `#!/usr/bin/env bash
set -u
SCRIPT_DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"
exec "$SCRIPT_DIR/${context.packager.executableName}.bin" "--no-sandbox" "$@"
`;

    try {
        await fs.promises.rename(executable, executable + '.bin');
        await fs.promises.writeFile(executable, loaderScript);
        await fs.promises.chmod(executable, 0o755);
    } catch (e) {
        throw new Error('Failed to create loader for sandbox fix:\n' + e);
    }
};
