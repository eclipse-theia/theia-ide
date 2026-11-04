/********************************************************************************
 * Copyright (C) 2021 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as os from 'os';
import * as path from 'path';

import { ElectronMainApplication, ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';

import { injectable } from '@theia/core/shared/inversify';
import { BrowserWindow } from '@theia/core/electron-shared/electron';

@injectable()
export class IconContribution implements ElectronMainApplicationContribution {

    onStart(application: ElectronMainApplication): void {
        if (os.platform() === 'linux') {
            const windowOptions = application.config.electron.windowOptions;
            if (windowOptions && windowOptions.icon === undefined) {
                // The window image is undefined. If the executable has an image set, this is used as a fallback.
                // Since AppImage does not support this anymore via electron-builder, set an image for the linux platform.
                windowOptions.icon = path.join(import.meta.dirname, '../../resources/icons/WindowIcon/512-512.png');
                // also update any existing windows, e.g. the splashscreen
                for (const window of BrowserWindow.getAllWindows()) {
                    window.setIcon(path.join(import.meta.dirname, '../../resources/icons/WindowIcon/512-512.png'));
                }
            }

        }
    }
}
