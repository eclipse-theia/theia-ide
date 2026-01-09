/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';

export const TheiaUpdaterPath = '/services/theia-updater';
export const TheiaUpdater = Symbol('TheiaUpdater');
export interface UpdaterSettings {
    checkForUpdates: boolean;
    checkInterval: number;
    channel: 'stable' | 'preview';
}

export interface TheiaUpdater extends RpcServer<TheiaUpdaterClient> {
    checkForUpdates(): void;
    downloadUpdate(): void;
    onRestartToUpdateRequested(): void;
    disconnectClient(client: TheiaUpdaterClient): void;
    cancel(): void;
    setUpdaterSettings(settings: UpdaterSettings): void;
}

export const TheiaUpdaterClient = Symbol('TheiaUpdaterClient');

export interface UpdaterError {
    message: string;
    errorLogPath?: string;
}

export interface UpdateInfo {
    version: string;
}

export interface UpdateAvailabilityInfo {
    available: boolean;
    updateInfo?: UpdateInfo;
}

export interface TheiaUpdaterClient {
    updateAvailable(available: boolean, updateInfo?: UpdateInfo): void;
    notifyReadyToInstall(): void;
    reportError(error: UpdaterError): void;
    reportCancelled(): void;
}
