/********************************************************************************
 * Copyright (C) 2022-2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ContainerModule } from '@theia/core/shared/inversify';
import { TheiaLauncherServiceEndpoint } from './launcher-endpoint.js';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { TheiaDesktopFileServiceEndpoint } from './desktopfile-endpoint.js';

export default new ContainerModule(bind => {
    bind(TheiaLauncherServiceEndpoint).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(TheiaLauncherServiceEndpoint);

    bind(TheiaDesktopFileServiceEndpoint).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(TheiaDesktopFileServiceEndpoint);
});
