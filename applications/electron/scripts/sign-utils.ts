/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import fs from 'fs';
import path from 'path';

export interface WalkOptions {
    /** Directory names to skip entirely while recursing (e.g. `['node_modules', '.git']`). */
    skipDirs?: string[];
    /** If true, do not recurse into subdirectories - only list direct children. Default: false. */
    shallow?: boolean;
}

/**
 * Recursively walks `root` and returns all file paths for which `filter` returns `true`.
 * If `root` does not exist, returns an empty array.
 */
export function walkFiles(root: string, filter: (file: string) => boolean, opts: WalkOptions = {}): string[] {
    const result: string[] = [];
    if (!fs.existsSync(root)) {
        return result;
    }
    const skipDirs = new Set(opts.skipDirs ?? []);

    const visit = (currentPath: string): void => {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                if (skipDirs.has(entry.name)) {
                    continue;
                }
                if (opts.shallow) {
                    continue;
                }
                visit(fullPath);
            } else if (entry.isFile() && filter(fullPath)) {
                result.push(fullPath);
            }
        }
    };

    visit(root);
    return result;
    }

/**
 * Replaces `originalPath` with `signedPath` on disk, preserving the file mode of the original.
 * On POSIX `renameSync` atomically replaces the destination, so no separate unlink is needed.
 */
export function replaceWithSigned(originalPath: string, signedPath: string): void {
    const originalMode = fs.statSync(originalPath).mode;
    fs.renameSync(signedPath, originalPath);
    fs.chmodSync(originalPath, originalMode);
}

/** Format a byte count as a human-readable string (e.g. `12.3 MB`). */
export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return `${bytes}`;
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
