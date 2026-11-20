/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { ContainerModule } from '@theia/core/shared/inversify';
import { VERSIONS_SERVICE_PATH, VersionsService } from '../common/versions-service.js';
import { VersionsServiceImpl } from './versions-service-impl.js';

export default new ContainerModule(bind => {
    bind(VersionsService).to(VersionsServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(VERSIONS_SERVICE_PATH, () => ctx.container.get<VersionsService>(VersionsService))
    ).inSingletonScope();
});
