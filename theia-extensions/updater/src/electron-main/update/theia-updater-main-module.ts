/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { TheiaUpdater, TheiaUpdaterClient, TheiaUpdaterPath } from '../../common/updater/theia-updater.js';
import { ContainerModule } from '@theia/core/shared/inversify';
import { ElectronConnectionHandler } from '@theia/core/lib/electron-main/messaging/electron-connection-handler';
import { ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';
import { JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging/proxy-factory';
import { TheiaUpdaterImpl } from './theia-updater-impl.js';

export default new ContainerModule(bind => {
    bind(TheiaUpdaterImpl).toSelf().inSingletonScope();
    bind(TheiaUpdater).toService(TheiaUpdaterImpl);
    bind(ElectronMainApplicationContribution).toService(TheiaUpdater);
    bind(ElectronConnectionHandler).toDynamicValue(context =>
        new JsonRpcConnectionHandler<TheiaUpdaterClient>(TheiaUpdaterPath, client => {
            const server = context.container.get<TheiaUpdater>(TheiaUpdater);
            server.setClient(client);
            client.onDidCloseConnection(() => server.disconnectClient(client));
            return server;
        })
    ).inSingletonScope();
});
