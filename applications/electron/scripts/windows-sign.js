// @ts-check
const path = require('path');
const child_process = require('child_process');
const fs = require('fs');

const WINDOWS_SIGNING_URL = 'https://cbi.eclipse.org/authenticode/sign';
const REMOTE_HOST = 'genie.theia@projects-storage.eclipse.org';

/**
 * Executes a command and returns the result
 * @param {string} command
 * @param {string[]} args
 * @param {object} options
 */
function exec(command, args, options = {}) {
    console.log(`[windows-sign] Executing: ${command} ${args.join(' ')}`);
    const result = child_process.spawnSync(command, args, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10,
        ...options
    });

    if (result.stdout) {
        console.log(`[windows-sign] stdout: ${result.stdout}`);
    }
    if (result.stderr) {
        console.log(`[windows-sign] stderr: ${result.stderr}`);
    }
    if (result.error) {
        console.error(`[windows-sign] error: ${result.error.message}`);
    }
    console.log(`[windows-sign] exit code: ${result.status}`);

    return result;
}

/**
 * Executes a command via SSH on the remote server
 * @param {string} command
 */
function sshExec(command) {
    return exec('ssh', ['-q', REMOTE_HOST, command]);
}

/**
 * Copies a file to the remote server
 * @param {string} localPath
 * @param {string} remotePath
 */
function scpTo(localPath, remotePath) {
    return exec('scp', ['-p', localPath, `${REMOTE_HOST}:${remotePath}`]);
}

/**
 * Copies a file from the remote server
 * @param {string} remotePath
 * @param {string} localPath
 */
function scpFrom(remotePath, localPath) {
    return exec('scp', ['-T', '-p', `${REMOTE_HOST}:${remotePath}`, localPath]);
}

/**
 * Verifies the Authenticode signature of a file using PowerShell
 * @param {string} filePath
 * @returns {boolean}
 */
function verifySignature(filePath) {
    if (process.platform !== 'win32') {
        console.log('[windows-sign] Skipping signature verification (not on Windows)');
        return true;
    }

    console.log(`[windows-sign] Verifying signature on ${filePath}...`);
    const result = child_process.spawnSync('powershell', [
        '-NoProfile',
        '-Command',
        `(Get-AuthenticodeSignature -FilePath '${filePath}').Status`
    ], { encoding: 'utf8' });

    const status = result.stdout?.trim();
    console.log(`[windows-sign] Signature status: ${status}`);

    return status === 'Valid';
}

/**
 * Custom Windows signing function for electron-builder
 */
exports.default = async function sign(configuration) {
    const running_ci = process.env.THEIA_IDE_JENKINS_CI === 'true';

    // eslint-disable-next-line no-null/no-null
    console.log(`[windows-sign] Configuration received: ${JSON.stringify(configuration, null, 2)}`);

    if (!running_ci) {
        // uncomment for debugging, otherwise this spams a lot when building locally
        // console.log(`[windows-sign] Not running in CI - skipping signing for ${configuration.path}`);
        return;
    }

    const filePath = configuration.path;
    const startTime = Date.now();
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);
    const signedFileName = `signed-${fileName}`;
    const signedFilePath = path.join(fileDir, signedFileName);
    const remoteFileName = fileName;
    const remoteSignedFileName = `signed-${fileName}`;

    console.log('[windows-sign] ========================================');
    console.log('[windows-sign] Starting signing process');
    console.log(`[windows-sign] Input file: ${filePath}`);
    console.log(`[windows-sign] Output file: ${signedFilePath}`);
    console.log(`[windows-sign] Signing URL: ${WINDOWS_SIGNING_URL}`);
    console.log('[windows-sign] ========================================');

    // Verify input file exists
    if (!fs.existsSync(filePath)) {
        throw new Error(`[windows-sign] Input file not found: ${filePath}`);
    }

    const inputStats = fs.statSync(filePath);
    console.log(`[windows-sign] Input file size: ${inputStats.size} bytes`);

    // Step 1: Copy file to remote server
    console.log('[windows-sign] Step 1: Copying file to remote server...');
    let result = scpTo(filePath, `./${remoteFileName}`);
    if (result.status !== 0) {
        throw new Error(`[windows-sign] Failed to copy file to remote server: ${result.stderr || 'no error details'}`);
    }

    // Step 2: Call signing service via SSH + curl
    console.log('[windows-sign] Step 2: Calling signing service...');
    const curlCommand = `curl -f -o "${remoteSignedFileName}" -F file=@"${remoteFileName}" "${WINDOWS_SIGNING_URL}"`;
    result = sshExec(curlCommand);
    if (result.status !== 0) {
        // Try to get error information
        console.log('[windows-sign] Signing failed, attempting to get error details...');
        sshExec(`cat "${remoteSignedFileName}" 2>/dev/null | head -c 1000 || echo 'No output file found'`);
        // Cleanup
        sshExec(`rm -f "${remoteFileName}" "${remoteSignedFileName}"`);
        throw new Error(`[windows-sign] Remote signing service failed: ${result.stderr || 'no error details'}`);
        }

    // Step 3: Check signed file on remote server
    console.log('[windows-sign] Step 3: Checking signed file on remote server...');
    result = sshExec(`ls -la "${remoteSignedFileName}" && file "${remoteSignedFileName}"`);
    if (result.status !== 0) {
        sshExec(`rm -f "${remoteFileName}" "${remoteSignedFileName}"`);
        throw new Error(`[windows-sign] Signed file not found on remote server: ${result.stderr || 'no error details'}`);
        }

    // Step 4: Copy signed file back
    console.log('[windows-sign] Step 4: Copying signed file back...');
    result = scpFrom(`./${remoteSignedFileName}`, signedFilePath);
    if (result.status !== 0) {
        sshExec(`rm -f "${remoteFileName}" "${remoteSignedFileName}"`);
        throw new Error(`[windows-sign] Failed to copy signed file from remote server: ${result.stderr || 'no error details'}`);
        }

    // Step 5: Cleanup remote files
    console.log('[windows-sign] Step 5: Cleaning up remote files...');
    sshExec(`rm -f "${remoteFileName}" "${remoteSignedFileName}"`);

    // Step 6: Replace original file with signed file
    console.log('[windows-sign] Step 6: Replacing original file with signed file...');
    if (!fs.existsSync(signedFilePath)) {
        throw new Error(`[windows-sign] Signed file not found at ${signedFilePath}`);
    }
    const stats = fs.statSync(signedFilePath);
    console.log(`[windows-sign] Signed file size: ${stats.size} bytes`);

    // Replace the original file with the signed one
    fs.unlinkSync(filePath);
    fs.renameSync(signedFilePath, filePath);
    console.log(`[windows-sign] Replaced ${filePath} with signed version`);

    // Step 7: Verify signature
    console.log('[windows-sign] Step 7: Verifying signature...');
    if (!verifySignature(filePath)) {
        throw new Error(`[windows-sign] Signature verification failed for ${filePath}`);
    }

    console.log(`[windows-sign] Total signing time: ${(Date.now() - startTime) / 1000}s`);
    console.log('[windows-sign] ========================================');
    console.log(`[windows-sign] Successfully signed ${fileName}`);
    console.log('[windows-sign] ========================================');
    };
