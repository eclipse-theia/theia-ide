/********************************************************************************
 * Copyright (C) 2025 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import * as path from 'path';

const argv = yargs(hideBin(process.argv))
    .option('directory', {
        alias: 'e',
        type: 'string',
        default: 'plugins',
        description: 'The parent directory which contains the files we need to make writable',
    })
    .version(false)
    .wrap(120)
    .parseSync();

execute();

async function execute(): Promise<void> {
    const directory = argv.directory;
    console.log(`Input directory: ${directory}`);

    try {
        makeWritable(directory);
    } catch (error) {
        console.error(`Failed to make files writable: ${error.message}`);
        process.exit(1);
    }
}

function makeWritable(dir: string): void {
    if (!fs.existsSync(dir)) {
        throw new Error(`Directory '${dir}' does not exist.`);
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            makeWritable(fullPath);
        } else if (entry.isFile()) {
            const stats = fs.statSync(fullPath);
            const isWritable = (stats.mode & 0o200) !== 0;
            if (!isWritable) {
                const isExecutable = (stats.mode & 0o111) !== 0;
                const newMode = isExecutable ? 0o755 : 0o644;
                console.log(`Making '${fullPath}' writable with mode '${isExecutable ? '0o755' : '0o644'}'`);
                fs.chmodSync(fullPath, newMode);
            }
        }
    }
}
