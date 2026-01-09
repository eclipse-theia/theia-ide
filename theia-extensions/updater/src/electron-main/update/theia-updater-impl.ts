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
import { TheiaUpdater, TheiaUpdaterClient, UpdaterSettings } from '../../common/updater/theia-updater';
import { injectable } from '@theia/core/shared/inversify';
import { isOSX, isWindows } from '@theia/core';
import { CancellationToken } from 'builder-util-runtime';

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
    protected settings: UpdaterSettings = {
        checkForUpdates: true,
        checkInterval: 60,
        channel: 'stable'
    };

    private initialCheck: boolean = true;
    private reportOnFirstRegistration: boolean = false;
    private cancellationToken: CancellationToken = new CancellationToken();
    private updateCheckTimer: NodeJS.Timeout | undefined;

    constructor() {
        autoUpdater.autoDownload = false;
        autoUpdater.on('update-available', (info: { version: string }) => {
            if (this.initialCheck) {
                this.initialCheck = false;
                if (this.clients.length === 0) {
                    this.reportOnFirstRegistration = true;
                }
            }
            const updateInfo = { version: info.version };
            this.clients.forEach(c => c.updateAvailable(true, updateInfo));
        });
        autoUpdater.on('update-not-available', () => {
            if (this.initialCheck) {
                this.initialCheck = false;
                return;
            }
            this.clients.forEach(c => c.updateAvailable(false));
        });

        autoUpdater.on('update-downloaded', () => {
            this.clients.forEach(c => c.notifyReadyToInstall());
        });

        autoUpdater.on('error', (err: unknown) => {
            if (err instanceof Error && err.message.includes('cancelled')) {
                return;
            }
            const errorLogPath = autoUpdater.logger.transports.file.getFile().path;
            this.clients.forEach(c => c.reportError({ message: 'An error has occurred while attempting to update.', errorLogPath }));
        });
    }

    checkForUpdates(): void {
        const feedURL = this.getFeedURL(this.settings.channel);
        autoUpdater.setFeedURL(feedURL);
        autoUpdater.checkForUpdates();
    }

    setUpdaterSettings(settings: UpdaterSettings): void {
        const settingsChanged = this.settings.checkForUpdates !== settings.checkForUpdates ||
            this.settings.checkInterval !== settings.checkInterval ||
            this.settings.channel !== settings.channel;
        this.settings = settings;
        if (settingsChanged) {
            this.scheduleUpdateChecks();
        }
    }

    onRestartToUpdateRequested(): void {
        autoUpdater.quitAndInstall();
    }

    cancel(): void {
        autoUpdater.logger.info('Update cancelled by user');
        this.cancellationToken.cancel();
        this.clients.forEach(c => c.reportCancelled());
    }

    downloadUpdate(): void {
        autoUpdater.logger.info('Downloading update');
        this.cancellationToken = new CancellationToken();
        autoUpdater.downloadUpdate(this.cancellationToken);

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
    }

    onStop(application: ElectronMainApplication): void {
        this.stopUpdateCheckTimer();
    }

    private scheduleUpdateChecks(): void {
        this.stopUpdateCheckTimer();

        if (!this.settings.checkForUpdates) {
            return;
        }

        this.checkForUpdates();

        const intervalMs = Math.max(this.settings.checkInterval, 1) * 60 * 1000;

        this.updateCheckTimer = setInterval(() => {
            if (this.settings.checkForUpdates) {
                this.checkForUpdates();
            }
        }, intervalMs);
    }

    private stopUpdateCheckTimer(): void {
        if (this.updateCheckTimer) {
            clearInterval(this.updateCheckTimer);
            this.updateCheckTimer = undefined;
        }
    }

    setClient(client: TheiaUpdaterClient | undefined): void {
        if (client) {
            this.clients.push(client);
            if (this.reportOnFirstRegistration) {
                this.reportOnFirstRegistration = false;
                this.clients.forEach(c => c.updateAvailable(true));
            }
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
        this.stopUpdateCheckTimer();
        this.clients.forEach(this.disconnectClient.bind(this));
    }

}
