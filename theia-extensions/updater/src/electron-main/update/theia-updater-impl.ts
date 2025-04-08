/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as fs from 'fs-extra';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { ElectronMainApplication, ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';
import { TheiaUpdater, TheiaUpdaterClient } from '../../common/updater/theia-updater';
import { injectable } from '@theia/core/shared/inversify';
import { isOSX, isWindows } from '@theia/core';

const STABLE_CHANNEL_WINDOWS = 'https://download.eclipse.org/theia/ide/version/windows';
const STABLE_CHANNEL_MACOS = 'https://download.eclipse.org/theia/ide/latest/macos';
const STABLE_CHANNEL_MACOS_ARM = 'https://download.eclipse.org/theia/ide/latest/macos-arm';
const STABLE_CHANNEL_LINUX = 'https://download.eclipse.org/theia/ide/latest/linux';

const PREVIEW_CHANNEL_WINDOWS = 'https://download.eclipse.org/theia/ide-preview/version/windows';
const PREVIEW_CHANNEL_MACOS = 'https://download.eclipse.org/theia/ide-preview/latest/macos';
const PREVIEW_CHANNEL_MACOS_ARM = 'https://download.eclipse.org/theia/ide-preview/latest/macos-arm';
const PREVIEW_CHANNEL_LINUX = 'https://download.eclipse.org/theia/ide-preview/latest/linux';

const { autoUpdater } = require('electron-updater');

autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

@injectable()
export class TheiaUpdaterImpl implements TheiaUpdater, ElectronMainApplicationContribution {

    protected clients: Array<TheiaUpdaterClient> = [];

    private initialCheck: boolean = true;
    private updateChannelReported: boolean = false;
    private reportOnFirstRegistration: boolean = false;

    constructor() {
        autoUpdater.autoDownload = false;
        autoUpdater.on('update-available', () => {
            if (this.updateChannelReported) {
                const startupCheck = this.initialCheck;
                if (this.initialCheck) {
                    this.initialCheck = false;
                    if (this.clients.length === 0) {
                        this.reportOnFirstRegistration = true;
                    }
                }
                this.clients.forEach(c => c.updateAvailable(true, startupCheck));
            }
        });
        autoUpdater.on('update-not-available', () => {
            if (this.updateChannelReported) {
                if (this.initialCheck) {
                    this.initialCheck = false;
                    /* do not report that no update is available on start up */
                    return;
                }
                this.clients.forEach(c => c.updateAvailable(false, false));
            }
        });

        autoUpdater.on('update-downloaded', () => {
            this.clients.forEach(c => c.notifyReadyToInstall());
        });

        autoUpdater.on('error', (err: unknown) => {
            const errorLogPath = autoUpdater.logger.transports.file.getFile().path;
            this.clients.forEach(c => c.reportError({ message: 'An error has occurred while attempting to update.', errorLogPath }));
        });
    }

    checkForUpdates(): void {
        autoUpdater.checkForUpdates();
    }

    onRestartToUpdateRequested(): void {
        autoUpdater.quitAndInstall();
    }

    downloadUpdate(): void {
        autoUpdater.downloadUpdate();

        // record download stat, ignore errors
        fs.mkdtemp(path.join(os.tmpdir(), 'updater-'))
            .then(tmpDir => {
                const file = fs.createWriteStream(path.join(tmpDir, 'update'));
                http.get('https://www.eclipse.org/downloads/download.php?file=/theia/update&r=1', response => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                    });
                });
            });
    }

    onStart(application: ElectronMainApplication): void {
        // Called when the contribution is starting. You can use both async and sync code from here.
        this.checkForUpdates();
    }

    onStop(application: ElectronMainApplication): void {
        // Invoked when the contribution is stopping. You can clean up things here. You are not allowed call async code from here.
    }

    setClient(client: TheiaUpdaterClient | undefined): void {
        if (client) {
            this.clients.push(client);
            if (this.reportOnFirstRegistration) {
                this.reportOnFirstRegistration = false;
                this.clients.forEach(c => c.updateAvailable(true, true));
            }
        }
    }

    setUpdateChannel(channel: string): void {
        const feedURL = this.getFeedURL(channel);
        autoUpdater.setFeedURL(feedURL);
        if (!this.updateChannelReported) {
            this.updateChannelReported = true;
            this.checkForUpdates();
        }
    }

    protected getFeedURL(channel: string): string {
        if (isWindows) {
            const curVersion = autoUpdater.currentVersion.toString();
            return (channel === 'preview') ? PREVIEW_CHANNEL_WINDOWS.replace('version', curVersion) : STABLE_CHANNEL_WINDOWS.replace('version', curVersion);
        } else if (isOSX) {
            if (process.arch === 'arm64') {
                return (channel === 'preview') ? PREVIEW_CHANNEL_MACOS_ARM : STABLE_CHANNEL_MACOS_ARM;
            } else {
                return (channel === 'preview') ? PREVIEW_CHANNEL_MACOS : STABLE_CHANNEL_MACOS;
            }
        } else {
            return (channel === 'preview') ? PREVIEW_CHANNEL_LINUX : STABLE_CHANNEL_LINUX;
        }
    }

    disconnectClient(client: TheiaUpdaterClient): void {
        const index = this.clients.indexOf(client);
        if (index !== -1) {
            this.clients.splice(index, 1);
        }
    }

    dispose(): void {
        this.clients.forEach(this.disconnectClient.bind(this));
    }

}
