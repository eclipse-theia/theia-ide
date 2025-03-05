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
const sign_util = require('electron-osx-sign/util');
import fs from 'fs';
import child_process from 'child_process';

const signCommand = path.join(__dirname, 'sign.sh');
const notarizeCommand = path.join(__dirname, 'notarize.sh');
const entitlements = path.resolve(__dirname, '..', 'entitlements.plist');
const signFile = (file: string) => {
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

const argv = yargs(hideBin(process.argv))
    .option('directory', { alias: 'd', type: 'string', default: 'dist', description: 'The directory which contains the application to be signed' })
    .version(false)
    .wrap(120)
    .parseSync();

execute();

async function execute(): Promise<void> {
    console.log(`signCommand: ${signCommand}; notarizeCommand: ${notarizeCommand}; entitlements: ${entitlements}; directory: ${argv.directory}`);
    let childPaths = await sign_util.walkAsync(argv.directory);
    childPaths = childPaths.sort((a: string, b: string) => {
        const aDepth = a.split(path.sep).length;
        const bDepth = b.split(path.sep).length;
        return bDepth - aDepth;
    });
    childPaths.forEach((file: string) => signFile(file));

    // Notarize app
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
