/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import {
    Command,
    CommandContribution,
    CommandRegistry,
    Emitter,
    MenuContribution,
    MenuModelRegistry,
    MenuPath,
    MessageService,
    Progress
} from '@theia/core/lib/common';
import { PreferenceScope, PreferenceService } from '@theia/core/lib/common';
import { TheiaUpdater, TheiaUpdaterClient, UpdaterError, UpdateInfo, UpdateAvailabilityInfo } from '../../common/updater/theia-updater';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { CommonMenus, OpenerService } from '@theia/core/lib/browser';
import { ElectronMainMenuFactory } from '@theia/core/lib/electron-browser/menu/electron-main-menu-factory';
import URI from '@theia/core/lib/common/uri';
import { URI as VSCodeURI } from 'vscode-uri';

export namespace TheiaUpdaterCommands {

    const category = 'Theia Electron Updater';

    export const CHECK_FOR_UPDATES: Command = {
        id: 'electron-theia:check-for-updates',
        label: 'Check for Updates...',
        category
    };

    export const RESTART_TO_UPDATE: Command = {
        id: 'electron-theia:restart-to-update',
        label: 'Restart to Update',
        category
    };

}

export namespace TheiaUpdaterMenu {
    export const MENU_PATH: MenuPath = [...CommonMenus.FILE_SETTINGS_SUBMENU, '3_settings_submenu_update'];
}

@injectable()
export class TheiaUpdaterClientImpl implements TheiaUpdaterClient {

    @inject(PreferenceService) private readonly preferenceService: PreferenceService;

    protected readonly onReadyToInstallEmitter = new Emitter<void>();
    readonly onReadyToInstall = this.onReadyToInstallEmitter.event;

    protected readonly onUpdateAvailableEmitter = new Emitter<UpdateAvailabilityInfo>();
    readonly onUpdateAvailable = this.onUpdateAvailableEmitter.event;

    protected readonly onErrorEmitter = new Emitter<UpdaterError>();
    readonly onError = this.onErrorEmitter.event;

    protected readonly onCancelEmitter = new Emitter<void>();
    readonly onCancel = this.onCancelEmitter.event;

    notifyReadyToInstall(): void {
        this.onReadyToInstallEmitter.fire();
    }

    updateAvailable(available: boolean, startupCheck: boolean, updateInfo?: UpdateInfo): void {
        if (startupCheck) {
            // When we are checking for updates after program launch we need to check whether to prompt the user
            // we need to wait for the preference service. Also add a few seconds delay before showing the dialog
            this.preferenceService.ready
                .then(() => {
                    setTimeout(() => {
                        const reportOnStart: boolean = this.preferenceService.get('updates.reportOnStart', true);
                        if (reportOnStart) {
                            this.onUpdateAvailableEmitter.fire({ available, updateInfo });
                        }
                    }, 10000);
                });
        } else {
            this.onUpdateAvailableEmitter.fire({ available, updateInfo });
        }

    }

    reportError(error: UpdaterError): void {
        this.onErrorEmitter.fire(error);
    }

    reportCancelled(): void {
        this.onCancelEmitter.fire();
    }

}

// Dynamic menus aren't yet supported by electron: https://github.com/eclipse-theia/theia/issues/446
@injectable()
export class ElectronMenuUpdater {

    @inject(ElectronMainMenuFactory)
    protected readonly factory: ElectronMainMenuFactory;

    public update(): void {
        this.setMenu();
    }

    private setMenu(): void {
        window.electronTheiaCore.setMenu(this.factory.createElectronMenuBar());
    }

}

@injectable()
export class TheiaUpdaterFrontendContribution implements CommandContribution, MenuContribution {

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(ElectronMenuUpdater)
    protected readonly menuUpdater: ElectronMenuUpdater;

    @inject(TheiaUpdater)
    protected readonly updater: TheiaUpdater;

    @inject(TheiaUpdaterClientImpl)
    protected readonly updaterClient: TheiaUpdaterClientImpl;

    @inject(PreferenceService)
    private readonly preferenceService: PreferenceService;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    protected readyToUpdate = false;

    private progress: Progress | undefined;
    private intervalId: NodeJS.Timeout | undefined;
    private currentUpdateInfo: UpdateInfo | undefined;

    @postConstruct()
    protected init(): void {
        this.preferenceService.ready.then(() => this.updater.setUpdateChannel(this.preferenceService.get('updates.channel', 'stable')));
        this.preferenceService.onPreferenceChanged(e => {
            if (e.preferenceName === 'updates.channel') {
                this.updater.setUpdateChannel(this.preferenceService.get('updates.channel', 'stable'));
            }
        });

        this.updaterClient.onUpdateAvailable(({ available, updateInfo }) => {
            if (available) {
                this.currentUpdateInfo = updateInfo;
                this.handleDownloadUpdate(updateInfo);
            } else {
                this.handleNoUpdate();
            }
        });

        this.updaterClient.onReadyToInstall(async () => {
            this.readyToUpdate = true;
            this.menuUpdater.update();
            this.handleUpdatesAvailable();
        });

        this.updaterClient.onError(error => this.handleError(error));
        this.updaterClient.onCancel(() => this.stopProgress());
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(TheiaUpdaterCommands.CHECK_FOR_UPDATES, {
            execute: async () => {
                this.updater.checkForUpdates();
            },
            isEnabled: () => !this.readyToUpdate,
            isVisible: () => !this.readyToUpdate
        });
        registry.registerCommand(TheiaUpdaterCommands.RESTART_TO_UPDATE, {
            execute: () => this.updater.onRestartToUpdateRequested(),
            isEnabled: () => this.readyToUpdate,
            isVisible: () => this.readyToUpdate
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerMenuAction(TheiaUpdaterMenu.MENU_PATH, {
            commandId: TheiaUpdaterCommands.CHECK_FOR_UPDATES.id
        });
        registry.registerMenuAction(TheiaUpdaterMenu.MENU_PATH, {
            commandId: TheiaUpdaterCommands.RESTART_TO_UPDATE.id
        });
    }

    protected async handleDownloadUpdate(updateInfo?: UpdateInfo): Promise<void> {
        const message = updateInfo
            ? `Update to version ${updateInfo.version} found, do you want to update?`
            : 'Updates found, do you want to update?';
        const answer = await this.messageService.info(message, 'No', 'Yes', 'Never');
        if (answer === 'Never') {
            this.preferenceService.set('updates.reportOnStart', false, PreferenceScope.User);
            return;
        }
        if (answer === 'Yes') {
            this.stopProgress();
            this.progress = await this.messageService.showProgress({
                text: 'Theia IDE Update',
                options: { cancelable: true }
            }, () => this.updater.cancel());
            let dots = 0;
            this.intervalId = setInterval(() => {
                if (this.progress !== undefined) {
                    dots = (dots + 1) % 4;
                    this.progress.report({ message: 'Downloading' + '.'.repeat(dots) });
                }
            }, 1000);
            this.updater.downloadUpdate();
        }
    }

    protected async handleNoUpdate(): Promise<void> {
        this.messageService.info('Already using the latest version');
    }

    protected async handleUpdatesAvailable(): Promise<void> {
        if (this.progress !== undefined) {
            this.progress.report({ work: { done: 1, total: 1 } });
            this.stopProgress();
        }
        const message = this.currentUpdateInfo
            ? `An update to version ${this.currentUpdateInfo.version} has been downloaded and will be automatically installed on exit. Do you want to restart now?`
            : 'An update has been downloaded and will be automatically installed on exit. Do you want to restart now?';
        const answer = await this.messageService.info(message, 'No', 'Yes');
        if (answer === 'Yes') {
            this.updater.onRestartToUpdateRequested();
        }
    }

    protected async handleError(error: UpdaterError): Promise<void> {
        this.stopProgress();
        if (error.errorLogPath) {
            const viewLogAction = 'View Error Log';
            const answer = await this.messageService.error(error.message, viewLogAction);
            if (answer === viewLogAction) {
                const uri = new URI(VSCodeURI.file(error.errorLogPath));
                const opener = await this.openerService.getOpener(uri);
                opener.open(uri);
            }
        } else {
            this.messageService.error(error.message);
        }
    }

    private stopProgress(): void {
        if (this.intervalId !== undefined) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        if (this.progress !== undefined) {
            this.progress.cancel();
            this.progress = undefined;
        }
    }
}
