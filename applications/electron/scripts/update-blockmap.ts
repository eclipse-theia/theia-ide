/********************************************************************************
 * Copyright (C) 2023 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import { buildBlockMap } from 'app-builder-lib/out/targets/blockmap/blockmap';
import { rmSync } from 'fs';
import * as path from 'path';

const BLOCK_MAP_FILE_SUFFIX = '.blockmap';

const argv = yargs(hideBin(process.argv))
    .option('executable', { alias: 'e', type: 'string', default: 'TheiaIDE.exe', description: 'The executable for which the blockmap needs to be updated' })
    .version(false)
    .wrap(120)
    .parseSync();

execute();

async function execute(): Promise<void> {
    const executable = argv.executable;
    const executablePath = path.resolve(
        __dirname,
        '../dist/',
        executable
    );
    const blockMapFile = `${executablePath}${BLOCK_MAP_FILE_SUFFIX}`;

    console.log(`Exe: ${executablePath}; Blockmap: ${blockMapFile}`);

    rmSync(blockMapFile, {
        force: true,
    });
    // 'gzip' matches what electron-builder itself uses when it writes a separate .blockmap file.
    await buildBlockMap(executablePath, 'gzip', blockMapFile);
};
