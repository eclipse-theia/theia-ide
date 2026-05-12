#!/usr/bin/env node

/********************************************************************************
 * Copyright (C) 2026 STMicroelectronics and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

// Generates app-update.yml for the Windows auto-updater.
//
// The normal electron-builder flow generates this file during afterPack, but
// only when the target is "nsis" or "appx". The Windows CI build splits
// packaging into two steps:
//   1. `electron-builder --dir` (target = "dir") → app-update.yml is skipped
//   2. `electron-builder --prepackaged` → afterPack does not run
//
// This script bridges that gap by writing the file before step 2.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const electronDir = path.resolve(__dirname, '..');
const pkg = require(path.join(electronDir, 'package.json'));
const builderConfig = yaml.load(fs.readFileSync(path.join(electronDir, 'electron-builder.yml'), 'utf8'));

const winPublish = builderConfig.win.publish;
const version = pkg.version;

// Expand ${version} macro in the URL, matching electron-builder's macro expansion
const url = winPublish.url.replace('${version}', version);

const appUpdateYml = {
    provider: winPublish.provider,
    url,
    ...(winPublish.useMultipleRangeRequest !== undefined && { useMultipleRangeRequest: winPublish.useMultipleRangeRequest }),
    updaterCacheDirName: `${pkg.name}-updater`
};

const outPath = path.join(electronDir, 'dist', 'win-unpacked', 'resources', 'app-update.yml');
fs.writeFileSync(outPath, yaml.dump(appUpdateYml, { lineWidth: -1 }));
console.log(`Generated ${outPath}`);
console.log(fs.readFileSync(outPath, 'utf8'));
