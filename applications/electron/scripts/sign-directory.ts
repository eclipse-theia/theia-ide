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
    const result: string[] = [];

    function scanDirectory(currentPath: string): void {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);

            // Skip node_modules and .git directories
            if (entry.isDirectory() &&
                entry.name !== 'node_modules' &&
                entry.name !== '.git') {
                scanDirectory(fullPath);
            } else if (entry.isFile() && isBinaryFile(fullPath)) {
                result.push(fullPath);
            }
        }
    }

    scanDirectory(dirPath);

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

    // Get SHA hash of file after signing - only for actual files, not directories
    if (stat.isFile()) {
        const shaAfterSigning = child_process.execSync(`shasum -a 256 "${file}"`).toString().trim();
        // Log a warning if the SHA hash hasn't changed after signing
        if (shaBeforeSigning === shaAfterSigning) {
            console.warn(`WARNING: SHA hash did not change after signing for ${file}. This might indicate the file was not properly signed.`);
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

execute();

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
    child_process.spawnSync(notarizeCommand, [
        path.basename(argv.directory),
        'eclipse.theia'
    ], {
        cwd: path.dirname(argv.directory),
        maxBuffer: 1024 * 10000,
        env: process.env,
        stdio: 'inherit',
        encoding: 'utf-8'
    });
}
