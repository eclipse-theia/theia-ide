/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import child_process from 'child_process';
import fs from 'fs';
import path from 'path';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import { formatBytes, replaceWithSigned, walkFiles } from './sign-utils';

/**
 * Sign Windows binaries inside an electron-builder `--dir` output (`win-unpacked`) by uploading
 * each `.exe` to the Eclipse Authenticode signing service and writing the signed result back in
 * place. The traversal must mirror the roots that electron-builder's `winPackager.signApp()`
 * would sign: the top level of the unpacked directory, `resources/app.asar.unpacked/` and
 * `swiftshader/`. The filter (`.exe` only) matches electron-builder's default `shouldSignFile`
 * when `win.signExts` is unset.
 */

const DEFAULT_SIGN_URL = 'https://cbi.eclipse.org/authenticode/sign';

const argv = yargs(hideBin(process.argv))
    .option('directory', {
        alias: 'd',
        type: 'string',
        demandOption: true,
        description: 'The electron-builder `--dir` output directory (e.g. dist/win-unpacked) containing the unpacked Windows app'
    })
    .option('url', {
        alias: 'u',
        type: 'string',
        default: DEFAULT_SIGN_URL,
        description: 'The URL of the Authenticode signing service'
    })
    .version(false)
    .wrap(120)
    .parseSync();

function isExeFile(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.exe';
}

/**
 * Collect files to sign by reproducing electron-builder's `winPackager.signApp()` traversal:
 *  1. Top-level files directly under `<dir>/` (no recursion)
 *  2. Recursive walk of `<dir>/resources/app.asar.unpacked/`
 *  3. Recursive walk of `<dir>/swiftshader/` (if present)
 */
function collectFilesToSign(unpackedDir: string): string[] {
    const topLevel = walkFiles(unpackedDir, isExeFile, { shallow: true });
    const asarUnpacked = walkFiles(path.join(unpackedDir, 'resources', 'app.asar.unpacked'), isExeFile);
    const swiftshader = walkFiles(path.join(unpackedDir, 'swiftshader'), isExeFile);
    return [...topLevel, ...asarUnpacked, ...swiftshader];
}

function signFile(file: string, url: string): void {
    const signedPath = `${file}.signed`;
    // Remove any stale signed file from a previous run
    if (fs.existsSync(signedPath)) {
        fs.unlinkSync(signedPath);
    }

    const before = fs.statSync(file);
    console.log(`Signing ${file} (${formatBytes(before.size)})...`);

    const started = Date.now();
    const result = child_process.spawnSync(
        'curl',
        ['-sSf', '-o', signedPath, '-F', `file=@${file}`, url],
        { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8' }
    );
    const durationMs = Date.now() - started;

    if (result.error) {
        throw new Error(`Failed to invoke curl for ${file}: ${result.error.message}`);
    }
    if (result.status !== 0) {
        // Dump whatever curl produced to help diagnose. If curl wrote a non-binary error payload to
        // `signedPath` (e.g. an HTML/JSON error page from the signing service), log that too.
        if (result.stdout) {
            console.error(`curl stdout:\n${result.stdout}`);
        }
        if (result.stderr) {
            console.error(`curl stderr:\n${result.stderr}`);
        }
        if (fs.existsSync(signedPath)) {
            try {
                const body = fs.readFileSync(signedPath, 'utf-8');
                console.error(`Response body written to ${signedPath}:\n${body}`);
            } catch {
                // Ignore read errors on binary/garbage content
            }
            try {
                fs.unlinkSync(signedPath);
            } catch {
                // Best-effort cleanup
            }
        }
        throw new Error(`Signing failed for ${file}: curl exited with status ${result.status}`);
    }

    if (!fs.existsSync(signedPath)) {
        throw new Error(`Signing failed for ${file}: no output file produced at ${signedPath}`);
    }

    const signedSize = fs.statSync(signedPath).size;
    if (signedSize === 0) {
        fs.unlinkSync(signedPath);
        throw new Error(`Signing failed for ${file}: signed output is empty`);
    }

    replaceWithSigned(file, signedPath);
    console.log(`  -> signed in ${durationMs} ms (${formatBytes(signedSize)})`);
}

function main(): void {
    const directory = path.resolve(argv.directory);
    const url = argv.url;

    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
        console.error(`Directory does not exist or is not a directory: ${directory}`);
        process.exit(1);
    }

    console.log(`sign-directory-windows: directory=${directory}; url=${url}`);

    const files = collectFilesToSign(directory);
    if (files.length === 0) {
        // Having zero files usually means the app layout changed and our walk roots no longer
        // match what electron-builder would sign. Fail so this is caught in CI rather than
        // silently shipping an unsigned binary.
        console.error(
            `No .exe files found under ${directory} in any of the expected roots (top level, ` +
            'resources/app.asar.unpacked, swiftshader). This likely indicates a change in the ' +
            'electron-builder output layout that sign-directory-windows has not been updated for.'
        );
        process.exit(1);
    }

    console.log(`Found ${files.length} file(s) to sign:`);
    for (const file of files) {
        console.log(`  - ${path.relative(directory, file)}`);
    }

    const overallStarted = Date.now();
    for (const file of files) {
        signFile(file, url);
    }
    const overallDuration = Date.now() - overallStarted;

    console.log(`Signed ${files.length} file(s) in ${overallDuration} ms.`);
}

main();
