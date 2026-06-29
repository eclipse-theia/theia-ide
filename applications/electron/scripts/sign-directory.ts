/********************************************************************************
 * Copyright (C) 2025 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import path from 'path';
import fs from 'fs';
import child_process from 'child_process';
import { walkFiles } from './sign-utils';

const signCommand = path.join(__dirname, 'sign.sh');
const notarizeCommand = path.join(__dirname, 'notarize.sh');
const entitlements = path.resolve(__dirname, '..', 'entitlements.plist');

// File extensions and patterns that need code signing on macOS
const BINARY_EXTENSIONS = ['.dylib', '.so', '.node', '.framework'];
const BINARY_PATTERNS = [
    /^MacOS\//, // Executable files in MacOS directory
    /^Contents\/MacOS\//, // Executable files in Contents/MacOS directory
];
const EXECUTABLE_NAMES = [
    'node', 'electron', 'rg', 'macos-trash', 'chrome-sandbox'
];

// Function to check if a file is likely a binary that needs signing
function isBinaryFile(filePath: string): boolean {
    const extension = path.extname(filePath);
    const fileName = path.basename(filePath);
    const relativePath = filePath.replace(/^.*?\.app\//, ''); // Get path relative to .app bundle

    // Check by extension
    if (BINARY_EXTENSIONS.includes(extension)) {
        return true;
    }

    // Check by executable name
    if (EXECUTABLE_NAMES.includes(fileName)) {
        return true;
    }

    // Check by pattern
    for (const pattern of BINARY_PATTERNS) {
        if (pattern.test(relativePath)) {
            return true;
        }
    }

    // Check if file is executable (Unix-only check)
    try {
        const stat = fs.statSync(filePath);
        if ((stat.mode & 0o111) !== 0) { // Check if execute bit is set
            // Further verify it's a binary with 'file' command if available
            try {
                const fileType = child_process.execSync(`file "${filePath}"`).toString();
                return fileType.includes('Mach-O') ||
                       fileType.includes('executable') ||
                       fileType.includes('shared library') ||
                       fileType.includes('dynamically linked');
            } catch (e) {
                // If 'file' command fails, fall back to assuming it's a binary if it has execute permission
                return true;
            }
        }
    } catch (e) {
        // If stat fails, skip this check
    }

    return false;
}

// Function to recursively find binaries in a directory
function findBinariesToSign(dirPath: string): string[] {
    const result = walkFiles(dirPath, isBinaryFile, { skipDirs: ['node_modules', '.git'] });

    // Sort by path depth (deepest first) to ensure nested binaries are signed first
    return result.sort((a, b) => {
        const aDepth = a.split(path.sep).length;
        const bDepth = b.split(path.sep).length;
        return bDepth - aDepth;
    });
}

const signFile = (file: string) => {
    const stat = fs.lstatSync(file);
    const mode = stat.isFile() ? stat.mode : undefined;

    // Get SHA hash of file before signing - only for actual files, not directories
    let shaBeforeSigning: string | undefined;
    if (stat.isFile()) {
        shaBeforeSigning = child_process.execSync(`shasum -a 256 "${file}"`).toString().trim();
    }

    console.log(`Signing ${file}...`);
    const result = child_process.spawnSync(signCommand, [
        path.basename(file),
        entitlements
    ], {
        cwd: path.dirname(file),
        maxBuffer: 1024 * 10000,
        env: process.env,
        stdio: 'inherit',
        encoding: 'utf-8'
    });

    // Fail hard if the signing command could not be spawned or exited with an error.
    // Otherwise a broken signing step (e.g. an unreachable signing host) is silently
    // ignored and produces an unsigned bundle that only fails much later at notarization.
    if (result.error) {
        throw new Error(`Failed to run signing command for ${file}: ${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`Signing command failed for ${file} with exit code ${result.status ?? `signal ${result.signal}`}.`);
    }

    // Get SHA hash of file after signing - only for actual files, not directories
    if (stat.isFile()) {
        const shaAfterSigning = child_process.execSync(`shasum -a 256 "${file}"`).toString().trim();
        if (shaBeforeSigning === shaAfterSigning) {
            // The signing service only signs Mach-O binaries and leaves other executables
            // (e.g. shell scripts like jdtls, *.sh, mvnw) untouched. That is expected:
            // Apple notarization only requires Mach-O executables to be signed. So only
            // treat an unchanged *Mach-O* file as a hard error; otherwise just warn.
            let isMachO = false;
            try {
                isMachO = child_process.execSync(`file "${file}"`).toString().includes('Mach-O');
            } catch (e) {
                // If 'file' cannot classify it, fall back to non-fatal.
            }
            if (isMachO) {
                throw new Error(`SHA hash did not change after signing for ${file}. The Mach-O binary was not properly signed.`);
            }
            console.warn(`WARNING: SHA hash did not change after signing for ${file}. Skipping - not a Mach-O binary.`);
        }
    }

    if (mode) {
        console.log(`Setting attributes of ${file}...`);
        fs.chmodSync(file, mode);
    }
};

const argv = yargs(hideBin(process.argv))
    .option('directory', { alias: 'd', type: 'string', default: 'dist', description: 'The directory which contains the application to be signed' })
    .version(false)
    .wrap(120)
    .parseSync();

execute().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});

async function execute(): Promise<void> {
    console.log(`signCommand: ${signCommand}; notarizeCommand: ${notarizeCommand}; entitlements: ${entitlements}; directory: ${argv.directory}`);

    // First sign all individual binaries inside the app bundle
    const binariesToSign = findBinariesToSign(argv.directory);

    for (const binaryPath of binariesToSign) {
        signFile(binaryPath);
    }

    // Then sign the main app bundle
    console.log('Signing main application bundle...');
    signFile(argv.directory);

    // Notarize app
    console.log('Notarizing application...');
    const notarizeResult = child_process.spawnSync(notarizeCommand, [
        path.basename(argv.directory),
        'eclipse.theia'
    ], {
        cwd: path.dirname(argv.directory),
        maxBuffer: 1024 * 10000,
        env: process.env,
        stdio: 'inherit',
        encoding: 'utf-8'
    });

    if (notarizeResult.error) {
        throw new Error(`Failed to run notarization command: ${notarizeResult.error.message}`);
    }
    if (notarizeResult.status !== 0) {
        throw new Error(`Notarization command failed with exit code ${notarizeResult.status ?? `signal ${notarizeResult.signal}`}.`);
    }
}
