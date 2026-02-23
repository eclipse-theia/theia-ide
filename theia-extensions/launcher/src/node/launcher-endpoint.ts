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

interface PathEntry {
    source: string;
    target: string;
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
        router.get('/initialized', (request, response) => this.isInitialized(request, response));
        app.use(json());
        app.use(TheiaLauncherServiceEndpoint.PATH, router);
    }

    private async isInitialized(request: Request, response: Response): Promise<void> {
        if (!process.env.APPIMAGE) {
            // we are not running from an AppImage, so there's nothing to initialize
            // return true
            response.json({ initialized: true });
        }
        const uriScheme = (request.query.uriScheme as string) || 'theia';
        const launcherLink = `/usr/local/bin/${uriScheme}`;
        const storageFile = await getStorageFilePath(this.envServer, TheiaLauncherServiceEndpoint.STORAGE_FILE_NAME);
        if (!storageFile) {
            throw new Error('Could not resolve path to storage file.');
        }
        if (!fs.existsSync(storageFile)) {
            response.json({ initialized: false });
            return;
        }
        const data = await this.readLauncherPathsFromStorage(storageFile);
        const initialized = !!data.find(entry => entry.source === launcherLink);
        response.json({ initialized });
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
        const shouldCreateLauncher = request.body.create;
        const uriScheme: string = request.body.uriScheme || 'theia';
        const launcher = `/usr/local/bin/${uriScheme}`;
        const sudoPromptName = uriScheme === 'theia-next' ? 'Theia IDE Next' : 'Theia IDE';
        const target = process.env.APPIMAGE;
        const logFile = await this.getLogFilePath();
        const command = `printf '%s\n' '#!/bin/bash' 'exec "${target}" \\$1 &> ${logFile} &' >${launcher} && chmod +x ${launcher}`;
        if (shouldCreateLauncher) {
            const targetExists = target && fs.existsSync(target);
            if (!targetExists) {
                throw new Error('Could not find application to launch');
            }
            sudo.exec(command, { name: sudoPromptName });
        }

        const storageFile = await getStorageFilePath(this.envServer, TheiaLauncherServiceEndpoint.STORAGE_FILE_NAME);
        const data = fs.existsSync(storageFile) ? await this.readLauncherPathsFromStorage(storageFile) : [];
        fs.outputJSONSync(storageFile, [...data, { source: launcher, target: shouldCreateLauncher ? target : undefined }]);

        response.sendStatus(200);
    }
}
