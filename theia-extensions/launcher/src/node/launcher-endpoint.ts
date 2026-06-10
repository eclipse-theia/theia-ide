/********************************************************************************
 * Copyright (C) 2022-2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { inject, injectable } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { Application, Router, Request, Response } from '@theia/core/shared/express';
import { json } from 'body-parser';
import { ILogger } from '@theia/core/lib/common';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import * as sudo from '@vscode/sudo-prompt';
import * as fs from 'fs-extra';
import URI from '@theia/core/lib/common/uri';
import { getStorageFilePath } from './launcher-util';

export type LauncherEndpointState = 'up-to-date' | 'needs-silent-update' | 'needs-prompt';

interface PathEntry {
    source: string;
    target?: string;
}

@injectable()
export class TheiaLauncherServiceEndpoint implements BackendApplicationContribution {
    protected static PATH = '/launcher';
    protected static STORAGE_FILE_NAME = 'paths.json';
    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(EnvVariablesServer)
    protected readonly envServer: EnvVariablesServer;

    configure(app: Application): void {
        const router = Router();
        router.put('/', (request, response) => this.createLauncher(request, response));
        router.get('/state', (request, response) => this.getState(request, response));
        app.use(json());
        app.use(TheiaLauncherServiceEndpoint.PATH, router);
    }

    protected async getState(request: Request, response: Response): Promise<void> {
        const uriScheme = request.query.uriScheme;
        if (typeof uriScheme !== 'string') {
            response.status(400).json({ error: 'uriScheme query parameter is required' });
            return;
        }
        response.json({ state: await this.computeState(uriScheme) });
    }

    protected async computeState(uriScheme: string): Promise<LauncherEndpointState> {
        if (!process.env.APPIMAGE) {
            // Not running from an AppImage — nothing to install.
            return 'up-to-date';
        }
        const launcher = `/usr/local/bin/${uriScheme}`;
        const storageFile = await getStorageFilePath(this.envServer, TheiaLauncherServiceEndpoint.STORAGE_FILE_NAME);
        if (!storageFile) {
            throw new Error('Could not resolve path to storage file.');
        }
        const data = await this.readLauncherPathsFromStorage(storageFile);
        // Latest entry wins so a previous decline followed by a later approve is honored correctly.
        const latest = [...data].reverse().find(entry => entry.source === launcher);
        if (!latest) {
            return 'needs-prompt';
        }
        if (latest.target === undefined) {
            // Previously declined for this scheme — don't re-prompt.
            return 'up-to-date';
        }
        if (latest.target !== process.env.APPIMAGE) {
            // AppImage path changed — ask for consent again.
            return 'needs-prompt';
        }
        // Prior consent recorded for this AppImage — re-apply silently if the on-disk
        // script no longer matches what the current generator would produce.
        const logFile = await this.getLogFilePath();
        const expected = this.buildLauncherScript(process.env.APPIMAGE, logFile);
        return this.fileMatches(launcher, expected) ? 'up-to-date' : 'needs-silent-update';
    }

    protected fileMatches(filePath: string, expectedContents: string): boolean {
        try {
            return fs.readFileSync(filePath, 'utf8') === expectedContents;
        } catch {
            return false;
        }
    }

    protected buildLauncherScript(target: string, logFile: string): string {
        // Must reproduce the exact bytes the printf-based writer in createLauncher produces.
        // The JS template builds `\$1`, but @vscode/sudo-prompt wraps the command in
        // `/bin/bash -c "..."`, and the outer double-quote layer consumes the backslash,
        // so the on-disk file ends up with `$1` (no backslash). Match that here.
        return `#!/bin/bash\nexec "${target}" $1 &> ${logFile} &\n`;
    }

    private async readLauncherPathsFromStorage(storageFile: string): Promise<PathEntry[]> {
        if (!fs.existsSync(storageFile)) {
            return [];
        }
        try {
            return await fs.readJSON(storageFile);
        } catch (error) {
            console.error('Failed to parse data from "', storageFile, '". Reason:', error);
            return [];
        }
    }

    private async getLogFilePath(): Promise<string> {
        const configDirUri = await this.envServer.getConfigDirUri();
        const logFileUri = new URI(configDirUri).resolve('logs/launcher.log');
        return logFileUri.path.fsPath();
    }

    private async createLauncher(request: Request, response: Response): Promise<void> {
        const { uriScheme } = request.body;
        if (typeof uriScheme !== 'string') {
            response.status(400).json({ error: 'uriScheme is required' });
            return;
        }
        const shouldCreateLauncher: boolean = !!request.body.create;
        const launcher = `/usr/local/bin/${uriScheme}`;
        const sudoPromptName = uriScheme === 'theia-next' ? 'Theia IDE Next' : 'Theia IDE';
        const target = process.env.APPIMAGE;
        const logFile = await this.getLogFilePath();
        if (shouldCreateLauncher) {
            const targetExists = target && fs.existsSync(target);
            if (!targetExists) {
                throw new Error('Could not find application to launch');
            }
            const command = `printf '%s\n' '#!/bin/bash' 'exec "${target}" \\$1 &> ${logFile} &' >${launcher} && chmod +x ${launcher}`;
            sudo.exec(command, { name: sudoPromptName });
        }

        const storageFile = await getStorageFilePath(this.envServer, TheiaLauncherServiceEndpoint.STORAGE_FILE_NAME);
        const data = fs.existsSync(storageFile) ? await this.readLauncherPathsFromStorage(storageFile) : [];
        const filtered = data.filter(existing => existing.source !== launcher);
        const entry: PathEntry = shouldCreateLauncher
            ? { source: launcher, target }
            : { source: launcher };
        fs.outputJSONSync(storageFile, [...filtered, entry]);

        response.sendStatus(200);
    }
}
