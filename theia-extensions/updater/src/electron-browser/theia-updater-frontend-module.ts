/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { ElectronMenuUpdater, TheiaUpdaterClientImpl, TheiaUpdaterFrontendContribution } from './updater/theia-updater-frontend-contribution';
import { TheiaUpdater, TheiaUpdaterClient, TheiaUpdaterPath } from '../common/updater/theia-updater';
import { ContainerModule } from '@theia/core/shared/inversify';
import { ElectronIpcConnectionProvider } from '@theia/core/lib/electron-browser/messaging/electron-ipc-connection-source';
import { PreferenceContribution } from '@theia/core/lib/common';
import { theiaUpdaterPreferenceSchema } from './updater/theia-updater-preferences';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    bind(ElectronMenuUpdater).toSelf().inSingletonScope();
    bind(TheiaUpdaterClientImpl).toSelf().inSingletonScope();
    bind(TheiaUpdaterClient).toService(TheiaUpdaterClientImpl);
    bind(TheiaUpdater).toDynamicValue(context => {
        const client = context.container.get(TheiaUpdaterClientImpl);
        return ElectronIpcConnectionProvider.createProxy(context.container, TheiaUpdaterPath, client);
    }).inSingletonScope();
    bind(TheiaUpdaterFrontendContribution).toSelf().inSingletonScope();
    bind(MenuContribution).toService(TheiaUpdaterFrontendContribution);
    bind(CommandContribution).toService(TheiaUpdaterFrontendContribution);

    bind(PreferenceContribution).toConstantValue({ schema: theiaUpdaterPreferenceSchema });
});
