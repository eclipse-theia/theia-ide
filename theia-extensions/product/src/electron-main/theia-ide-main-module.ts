/********************************************************************************
 * Copyright (C) 2021 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ContainerModule } from '@theia/core/shared/inversify';
import { ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';
import { IconContribution } from './icon-contribution.js';

export default new ContainerModule(bind => {
    bind(IconContribution).toSelf().inSingletonScope();
    bind(ElectronMainApplicationContribution).toService(IconContribution);
});
