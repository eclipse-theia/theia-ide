/********************************************************************************
 * Copyright (C) 2024 STMicroelectronics and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { Application, Router } from '@theia/core/shared/express';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Request, Response } from 'express-serve-static-core';
import { json } from 'body-parser';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { getStorageFilePath } from './launcher-util';
import * as fs from 'fs-extra';
import * as path from 'path';

interface DesktopFileInformation {
    appImage: string;
    declined: string[];
}

@injectable()
export class TheiaDesktopFileServiceEndpoint implements BackendApplicationContribution {

    protected static PATH = '/desktopfile';
    protected static STORAGE_FILE_NAME = 'desktopfile.json';

    @inject(EnvVariablesServer)
    protected readonly envServer: EnvVariablesServer;

    configure(app: Application): void {
        const router = Router();
        router.put('/', (request, response) => this.createOrUpdateDesktopfile(request, response));
        router.get('/initialized', (request, response) => this.isInitialized(request, response));
        app.use(json());
        app.use(TheiaDesktopFileServiceEndpoint.PATH, router);
    }

    protected async isInitialized(_request: Request, response: Response): Promise<void> {
        if (!process.env.APPIMAGE) {
            // we only want to create Desktop Files when running as an App Image
            response.json({ initialized: true });
        }
        if (process.env.HOME === undefined) {
            // log error but assume initialized, since we can't proceed
            console.error('Desktop files can only be created if there is a set HOME directory');
            response.json({ initialized: true });
        }
        const storageFile = await getStorageFilePath(this.envServer, TheiaDesktopFileServiceEndpoint.STORAGE_FILE_NAME);
        if (!storageFile) {
            throw new Error('Could not resolve path to storage file.');
        }
        if (!fs.existsSync(storageFile)) {
            response.json({ initialized: false });
            return;
        }
        const appImageInformation = await this.readAppImageInformationFromStorage(storageFile);
        if (appImageInformation === undefined) {
            response.json({ initialized: false });
            return;
        }
        if (appImageInformation.declined !== undefined && appImageInformation.declined.includes(process.env.APPIMAGE!)) {
            // we don't want to create Desktop Files for this App Image
            response.json({ initialized: true });
            return;
        }
        const initialized = appImageInformation.appImage === process.env.APPIMAGE;
        response.json({ initialized });
    }

    protected async readAppImageInformationFromStorage(storageFile: string): Promise<DesktopFileInformation | undefined> {
        if (!fs.existsSync(storageFile)) {
            return undefined;
        }
        try {
            const data: DesktopFileInformation = await fs.readJSON(storageFile);
            return data;
        } catch (error) {
            console.error('Failed to parse data from "', storageFile, '". Reason:', error);
            return undefined;
        }
    }

    protected async createOrUpdateDesktopfile(request: Request, response: Response): Promise<void> {
        const storageFile = await getStorageFilePath(this.envServer, TheiaDesktopFileServiceEndpoint.STORAGE_FILE_NAME);
        let appImageInformation: DesktopFileInformation | undefined = await this.readAppImageInformationFromStorage(storageFile);
        if (appImageInformation === undefined) {
            appImageInformation = { appImage: '', declined: [] };
        }

        const createOrUpdate = request.body.create;
        if (createOrUpdate) {
            const imagePath = path.join(process.env.HOME!, '.local', 'share', 'applications', 'theia-ide-electron-app.png');
            if (!fs.existsSync(imagePath)) {
                const appDir = process.env.APPDIR;
                if (appDir !== undefined) {
                    const unpackedImagePath = path.join(appDir, 'theia-ide-electron-app.png');
                    if (fs.existsSync(unpackedImagePath)) {
                        fs.copyFileSync(unpackedImagePath, imagePath);
                    } else {
                        console.warn('Launcher Icon not Found in App Image');
                    }
                } else {
                    console.warn('Path for unpacked App Image not found');
                }
            }

            const desktopFilePath = path.join(process.env.HOME!, '.local', 'share', 'applications', 'theia-ide-launcher.desktop');
            fs.outputFileSync(desktopFilePath, this.getDesktopFileContents(process.env.APPIMAGE!, imagePath));

            const desktopURLFilePath = path.join(process.env.HOME!, '.local', 'share', 'applications', 'theia-ide-launcher-url.desktop');
            fs.outputFileSync(desktopURLFilePath, this.getDesktopURLFileContents(process.env.APPIMAGE!, imagePath));

            appImageInformation.appImage = process.env.APPIMAGE!;
            fs.outputJSONSync(storageFile, appImageInformation);
        } else {
            appImageInformation.declined.push(process.env.APPIMAGE!);
            fs.outputJSONSync(storageFile, appImageInformation);
        }

        response.sendStatus(200);
    }

    protected getDesktopFileContents(appImagePath: string, imagePath: string): string {
        return `[Desktop Entry]
Name=Theia IDE
GenericName=Integrated Development Environment
Exec=${appImagePath} %U
Terminal=false
Type=Application
Icon=${imagePath}
StartupWMClass=Theia IDE
Comment=IDE for cloud and desktop
Categories=Development;IDE;`;
    }

    protected getDesktopURLFileContents(appImagePath: string, imagePath: string): string {
        return `[Desktop Entry]
Name=Theia IDE - URL Handler
GenericName=Integrated Development Environment
Exec=${appImagePath} --open-url %U
Terminal=false
Type=Application
NoDisplay=true
Icon=${imagePath}
MimeType=x-scheme-handler/theia;
Comment=IDE for cloud and desktop
Categories=Development;IDE;`;
    }
}
