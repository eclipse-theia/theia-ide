/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PackageJson } from 'type-fest';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

/** A release version, optionally with a pre-release and a build part, e.g. `1.76.0-next.0`. */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;
/** An npm dist tag, e.g. `next` or `latest`. */
const DIST_TAG_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/;
/** A `patch-package` file for a Theia package, e.g. `@theia+terminal+1.75.0.patch`. */
const THEIA_PATCH_PATTERN = /^(@theia\+[^+]+)\+(\d+\.\d+\.\d+.*)\.patch$/;

const argv = yargs(hideBin(process.argv))
    .option('theia', {
        alias: 't',
        type: 'string',
        description: 'THEIA_VERSION to consume, e.g. 1.76.0, 1.76.0-next.0 or the dist tag next. '
            + 'Omit if there is no new Theia release to consume',
    })
    .option('ide', {
        alias: 'i',
        type: 'string',
        demandOption: true,
        description: 'THEIA_IDE_VERSION to publish, e.g. 1.76.0 or 1.76.0-next.0. '
            + 'See section 1 of PUBLISHING.md for how to determine it',
    })
    .option('dry-run', {
        type: 'boolean',
        default: false,
        description: 'Print the resolved versions and the commands, but do not run them',
    })
    .version(false)
    .wrap(120)
    .parseSync();

execute();

function execute(): void {
    try {
        const currentVersion = readCurrentVersion();
        const theiaVersion = argv.theia;
        const ideVersion = argv.ide;
        assertVersions(theiaVersion, ideVersion);

        console.log(`Current Theia IDE version: ${currentVersion}`);
        console.log(`THEIA_IDE_VERSION:         ${ideVersion}`);
        console.log(`THEIA_VERSION:             ${theiaVersion ?? '(unchanged)'}`);
        console.log('');

        // 2.1 Install build dependencies
        run('yarn');

        // 2.2 Update versions
        if (ideVersion !== currentVersion) {
            run(`yarn version --no-git-tag-version --new-version ${ideVersion}`);
        } else {
            console.log(`Skipping the monorepo version update, package.json is already at ${ideVersion}.`);
        }
        if (theiaVersion) {
            run(`yarn update:theia ${theiaVersion}`);
            run(`yarn update:theia:children ${theiaVersion}`);
            renameTheiaPatches(theiaVersion);
        }
        run(`yarn lerna version ${ideVersion} --exact --no-push --no-git-tag-version --yes`);
        run('yarn');
    } catch (error) {
        console.error(`Failed to prepare the release: ${error.message}`);
        process.exit(1);
    }
}

function readCurrentVersion(): string {
    const packageJsonPath = path.resolve('./', 'package.json');
    const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf8' }));
    const version = packageJson.version;
    if (!version || !VERSION_PATTERN.test(version)) {
        throw new Error(`Could not read a valid version from ${packageJsonPath}. Run this script from the repository root.`);
    }
    return version;
}

/** Both versions are always passed in, the script never derives or guesses a version. */
function assertVersions(theiaVersion: string | undefined, ideVersion: string): void {
    if (!VERSION_PATTERN.test(ideVersion)) {
        throw new Error(`'--ide ${ideVersion}' is not a valid version. Expected 'major.minor.patch', e.g. '1.76.0' or '1.76.0-next.0'.`);
    }
    if (theiaVersion && !VERSION_PATTERN.test(theiaVersion) && !DIST_TAG_PATTERN.test(theiaVersion)) {
        throw new Error(`'--theia ${theiaVersion}' is neither a version nor a dist tag. Expected e.g. '1.76.0', '1.76.0-next.0' or 'next'.`);
    }
}

/**
 * `patch-package` reads the package version from the patch file name, so a patch that keeps the
 * previous version in its name is applied with a mismatch warning. Rename the Theia patches along
 * with the dependencies, before the lock file is refreshed and the patches are applied again.
 */
function renameTheiaPatches(theiaVersion: string): void {
    if (!VERSION_PATTERN.test(theiaVersion)) {
        console.log(`Skipping the patch file rename, the dist tag '${theiaVersion}' does not name a version.`);
        return;
    }
    const patchesDir = path.resolve('./', 'patches');
    if (!fs.existsSync(patchesDir)) {
        return;
    }
    for (const patch of fs.readdirSync(patchesDir)) {
        const match = THEIA_PATCH_PATTERN.exec(patch);
        if (!match || match[2] === theiaVersion) {
            continue;
        }
        const renamed = `${match[1]}+${theiaVersion}.patch`;
        console.log(`${argv.dryRun ? '[dry run] ' : ''}Renaming ${patch} to ${renamed}`);
        if (!argv.dryRun) {
            fs.renameSync(path.join(patchesDir, patch), path.join(patchesDir, renamed));
        }
    }
}

function run(command: string): void {
    if (argv.dryRun) {
        console.log(`[dry run] ${command}`);
        return;
    }
    console.log(`> ${command}`);
    execSync(command, { stdio: 'inherit' });
}
