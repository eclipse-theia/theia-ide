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
import { execFile } from 'child_process';

export type DesktopFileState = 'up-to-date' | 'needs-silent-update' | 'needs-prompt';

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
        router.get('/state', (request, response) => this.getState(request, response));
        app.use(json());
        app.use(TheiaDesktopFileServiceEndpoint.PATH, router);
    }

    protected async getState(request: Request, response: Response): Promise<void> {
        const applicationName = request.query.applicationName;
        const uriScheme = request.query.uriScheme;
        if (typeof applicationName !== 'string' || typeof uriScheme !== 'string') {
            response.status(400).json({ error: 'applicationName and uriScheme query parameters are required' });
            return;
        }
        response.json({ state: await this.computeState(applicationName, uriScheme) });
    }

    protected async computeState(applicationName: string, uriScheme: string): Promise<DesktopFileState> {
        if (!process.env.APPIMAGE) {
            return 'up-to-date';
        }
        if (process.env.HOME === undefined) {
            console.error('Desktop files can only be created if there is a set HOME directory');
            return 'up-to-date';
        }
        const storageFile = await getStorageFilePath(this.envServer, TheiaDesktopFileServiceEndpoint.STORAGE_FILE_NAME);
        if (!storageFile) {
            throw new Error('Could not resolve path to storage file.');
        }
        const info = await this.readAppImageInformationFromStorage(storageFile);
        if (!info || info.appImage !== process.env.APPIMAGE) {
            return info?.declined?.includes(process.env.APPIMAGE) ? 'up-to-date' : 'needs-prompt';
        }
        // Prior consent recorded for this AppImage — re-apply silently if the on-disk
        // files no longer match what the current launcher template would render.
        return this.isOnDiskUpToDate(applicationName, uriScheme) ? 'up-to-date' : 'needs-silent-update';
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
        const { applicationName, uriScheme } = request.body;
        if (typeof applicationName !== 'string' || typeof uriScheme !== 'string') {
            response.status(400).json({ error: 'applicationName and uriScheme are required' });
            return;
        }
        const createOrUpdate: boolean = !!request.body.create;
        const createUrlHandler: boolean = request.body.createUrlHandler !== false;
        const appId = this.getAppId(applicationName);

        const storageFile = await getStorageFilePath(this.envServer, TheiaDesktopFileServiceEndpoint.STORAGE_FILE_NAME);
        let appImageInformation: DesktopFileInformation | undefined = await this.readAppImageInformationFromStorage(storageFile);
        if (appImageInformation === undefined) {
            appImageInformation = { appImage: '', declined: [] };
        }

        if (createOrUpdate) {
            const iconFileName = appId + '-electron-app.png';
            const applicationsDir = this.getApplicationsDir();
            fs.ensureDirSync(applicationsDir);
            const imagePath = path.join(applicationsDir, iconFileName);
            if (!fs.existsSync(imagePath)) {
                const appDir = process.env.APPDIR;
                if (appDir !== undefined) {
                    let unpackedImagePath = path.join(appDir, iconFileName);
                    if (!fs.existsSync(unpackedImagePath)) {
                        // Fallback: find any .png icon in the AppImage root
                        try {
                            const pngFile = fs.readdirSync(appDir).find((f: string) => f.endsWith('.png'));
                            if (pngFile) {
                                unpackedImagePath = path.join(appDir, pngFile);
                            }
                        } catch { /* ignore */ }
                    }
                    if (fs.existsSync(unpackedImagePath)) {
                        fs.copyFileSync(unpackedImagePath, imagePath);
                    } else {
                        console.warn('Launcher Icon not Found in App Image');
                    }
                } else {
                    console.warn('Path for unpacked App Image not found');
                }
            }

            const desktopFilePath = path.join(applicationsDir, `${appId}-launcher.desktop`);
            fs.outputFileSync(desktopFilePath, this.getDesktopFileContents(applicationName, process.env.APPIMAGE!, imagePath));

            const urlDesktopFileName = `${appId}-launcher-url.desktop`;
            if (createUrlHandler) {
                const desktopURLFilePath = path.join(applicationsDir, urlDesktopFileName);
                fs.outputFileSync(desktopURLFilePath, this.getDesktopURLFileContents(applicationName, process.env.APPIMAGE!, imagePath, uriScheme));
            }

            appImageInformation.appImage = process.env.APPIMAGE!;
            fs.outputJSONSync(storageFile, appImageInformation);

            await this.refreshDesktopDatabase(applicationsDir, createUrlHandler ? { uriScheme, urlDesktopFileName } : undefined);
        } else {
            appImageInformation.declined.push(process.env.APPIMAGE!);
            fs.outputJSONSync(storageFile, appImageInformation);
        }

        response.sendStatus(200);
    }

    protected getDesktopFileContents(applicationName: string, appImagePath: string, imagePath: string): string {
        return `[Desktop Entry]
Name=${applicationName}
GenericName=Integrated Development Environment
Exec=${appImagePath} %U
Terminal=false
Type=Application
Icon=${imagePath}
StartupWMClass=${this.getAppId(applicationName)}
Comment=IDE for cloud and desktop
Categories=Development;IDE;`;
    }

    protected getDesktopURLFileContents(applicationName: string, appImagePath: string, imagePath: string, uriScheme: string): string {
        return `[Desktop Entry]
Name=${applicationName} - URL Handler
GenericName=Integrated Development Environment
Exec=${appImagePath} --open-url %U
Terminal=false
Type=Application
NoDisplay=true
Icon=${imagePath}
MimeType=x-scheme-handler/${uriScheme};
Comment=IDE for cloud and desktop
Categories=Development;IDE;`;
    }

    protected getAppId(applicationName: string): string {
        return applicationName.toLowerCase().replace(/\s+/g, '-');
    }

    protected getApplicationsDir(): string {
        // XDG Base Directory Spec: $XDG_DATA_HOME/applications, falling back to
        // $HOME/.local/share/applications when XDG_DATA_HOME is unset or empty.
        const xdgDataHome = process.env.XDG_DATA_HOME || path.join(process.env.HOME!, '.local', 'share');
        return path.join(xdgDataHome, 'applications');
    }

    protected isOnDiskUpToDate(applicationName: string, uriScheme: string): boolean {
        const appId = this.getAppId(applicationName);
        const applicationsDir = this.getApplicationsDir();
        const imagePath = path.join(applicationsDir, `${appId}-electron-app.png`);
        const launcherPath = path.join(applicationsDir, `${appId}-launcher.desktop`);
        const urlPath = path.join(applicationsDir, `${appId}-launcher-url.desktop`);
        const expectedLauncher = this.getDesktopFileContents(applicationName, process.env.APPIMAGE!, imagePath);
        const expectedUrl = this.getDesktopURLFileContents(applicationName, process.env.APPIMAGE!, imagePath, uriScheme);
        return this.fileMatches(launcherPath, expectedLauncher) && this.fileMatches(urlPath, expectedUrl);
    }

    protected fileMatches(filePath: string, expectedContents: string): boolean {
        try {
            return fs.readFileSync(filePath, 'utf8') === expectedContents;
        } catch {
            return false;
        }
    }

    // Best-effort refresh so xdg-open / gio open immediately route the registered scheme
    // to the freshly written .desktop file. Errors are logged but do not fail the request.
    protected async refreshDesktopDatabase(applicationsDir: string, urlHandler?: { uriScheme: string; urlDesktopFileName: string }): Promise<void> {
        if (process.platform !== 'linux') {
            return;
        }
        const tasks: Promise<void>[] = [this.runCommand('update-desktop-database', [applicationsDir])];
        if (urlHandler) {
            tasks.push(this.runCommand('xdg-mime', ['default', urlHandler.urlDesktopFileName, `x-scheme-handler/${urlHandler.uriScheme}`]));
        }
        await Promise.all(tasks);
    }

    protected runCommand(command: string, args: string[]): Promise<void> {
        return new Promise(resolve => {
            execFile(command, args, { timeout: 5000 }, error => {
                if (error) {
                    console.warn(`Launcher: '${command} ${args.join(' ')}' failed:`, error.message);
                }
                resolve();
            });
        });
    }
}
