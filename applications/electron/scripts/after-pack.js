#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const util = require('util');
const child_process = require('child_process');
const rimraf = require('rimraf');
const archiver = require('archiver');
const extract = require('extract-zip');
const asyncRimraf = util.promisify(rimraf);

const DELETE_PATHS = [
    'Contents/Resources/app/node_modules/unzip-stream/aa.zip',
    'Contents/Resources/app/node_modules/unzip-stream/testData*'
];

const signCommand = path.join(__dirname, 'sign.sh');
const notarizeCommand = path.join(__dirname, 'notarize.sh');
const entitlements = path.resolve(__dirname, '..', 'entitlements.plist');

const signFile = file => {
    const stat = fs.lstatSync(file);
    const mode = stat.isFile() ? stat.mode : undefined;

    console.log(`Signing ${file}...`);
    child_process.spawnSync(signCommand, [
        path.basename(file),
        entitlements
    ], {
        cwd: path.dirname(file),
        maxBuffer: 1024 * 10000,
        env: process.env,
        stdio: 'inherit',
        encoding: 'utf-8'
    });

    if (mode) {
        console.log(`Setting attributes of ${file}...`);
        fs.chmodSync(file, mode);
    }
};

async function zipDirectory(source, out) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(out);

    return new Promise((resolve, reject) => {
        archive
            .directory(source, false)
            .on('error', err => reject(err))
            .pipe(stream);

        stream.on('close', () => resolve());
        archive.finalize();
    });
}

async function unzipFile(zipPath, destination) {
    return extract(zipPath, { dir: destination });
}

exports.default = async function (context) {
    await afterPackHook(context);
    const running_ci = process.env.THEIA_IDE_JENKINS_CI === 'true';
    const releaseDryRun = process.env.THEIA_IDE_JENKINS_RELEASE_DRYRUN === 'true';
    const branch = process.env.BRANCH_NAME;
    const running_on_mac = context.packager.platform.name === 'mac';
    const appPath = path.resolve(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

    // Remove anything we don't want in the final package
    for (const deletePath of DELETE_PATHS) {
        const resolvedPath = path.resolve(appPath, deletePath);
        console.log(`Deleting ${resolvedPath}...`);
        await asyncRimraf(resolvedPath);
    }

    // Only continue for macOS during CI
    if ((( branch === 'master' || releaseDryRun)  && running_ci && running_on_mac)) {
        console.log('Detected Theia IDE Release on Mac ' + releaseDryRun ? ' (dry-run)' : ''
            + ' - proceeding with signing and notarizing');
    } else {
        if (running_on_mac) {
            console.log('Not a release or dry-run requiring signing/notarizing - skipping');
        }
        return;
    }

    // Create a zip of the contents at context.appOutDir
    const zipPath = path.resolve(context.appOutDir, '..', 'app-to-be-signed.zip');
    // const signedZipPath = path.resolve(context.appOutDir, '..', 'signed-app-to-be-signed.zip');
    console.log(`Creating zip of ${context.appOutDir} at ${zipPath}...`);
    await zipDirectory(context.appOutDir, zipPath);

    try {
        // Send the zip file to the signing service
        console.log('Sending zip file to signing service via sign.sh...');
        signFile(zipPath);

        console.log(`Expecting signed zip at ${zipPath}...`);

        // Replace the contents of context.appOutDir with the signed result
        console.log(`Unzipping signed contents from ${zipPath} to ${context.appOutDir}...`);
        await asyncRimraf(context.appOutDir); // Clean the output directory
        await unzipFile(zipPath, context.appOutDir);

        // Notarize app
        console.log('Proceeding with notarization...');
        child_process.spawnSync(notarizeCommand, [
            path.basename(appPath),
            context.packager.appInfo.info._configuration.appId
        ], {
            cwd: path.dirname(appPath),
            maxBuffer: 1024 * 10000,
            env: process.env,
            stdio: 'inherit',
            encoding: 'utf-8'
        });

        console.log('Signing and notarization complete.');
    } finally {
        // Clean up intermediate zip files
        console.log('Cleaning up intermediate files...');
        await asyncRimraf(zipPath);
        console.log('...cleanup done');
    }
};

// taken and modified from: https://github.com/gergof/electron-builder-sandbox-fix/blob/a2251d7d8f22be807d2142da0cf768c78d4cfb0a/lib/index.js
const afterPackHook = async params => {
    if (params.electronPlatformName !== 'linux') {
        // this fix is only required on linux
        return;
    }
    const executable = path.join(
        params.appOutDir,
        params.packager.executableName
    );

    const loaderScript = `#!/usr/bin/env bash
set -u
SCRIPT_DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"
exec "$SCRIPT_DIR/${params.packager.executableName}.bin" "--no-sandbox" "$@"
`;

    try {
        await fs.promises.rename(executable, executable + '.bin');
        await fs.promises.writeFile(executable, loaderScript);
        await fs.promises.chmod(executable, 0o755);
    } catch (e) {
        throw new Error('Failed to create loader for sandbox fix:\n' + e);
    }
};
