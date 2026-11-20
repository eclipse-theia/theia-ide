/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import '../../src/browser/style/index.css';

import { AIRegistryConfiguration } from '@theia/ai-registry/lib/common/ai-registry-configuration';
import { WidgetFactory } from '@theia/core/lib/browser';
import { AboutDialog } from '@theia/core/lib/browser/about-dialog';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { VERSIONS_SERVICE_PATH, VersionsService } from '../common/versions-service.js';
import { applyBranding } from './theia-ide-config.js';
import { CommandContribution } from '@theia/core/lib/common/command';
import { ContainerModule } from '@theia/core/shared/inversify';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { MenuContribution } from '@theia/core/lib/common/menu';
import { TheiaIDEAboutDialog } from './theia-ide-about-dialog.js';
import { TheiaIDEAIRegistryConfiguration } from './theia-ide-ai-registry-configuration.js';
import { TheiaIDEContribution } from './theia-ide-contribution.js';
import { TheiaIDEGettingStartedWidget } from './theia-ide-getting-started-widget.js';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    applyBranding();

    /*
     * Local rather than remote: the versions describe the desktop application the user runs, which stays the
     * same when a remote session (SSH, WSL, dev container) moves the other services to a remote backend.
     */
    bind(VersionsService).toDynamicValue(ctx =>
        ServiceConnectionProvider.createLocalProxy<VersionsService>(ctx.container, VERSIONS_SERVICE_PATH)
    ).inSingletonScope();

    bind(TheiaIDEGettingStartedWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: GettingStartedWidget.ID,
        createWidget: () => context.container.get<TheiaIDEGettingStartedWidget>(TheiaIDEGettingStartedWidget),
    })).inSingletonScope();
    if (isBound(AboutDialog)) {
        rebind(AboutDialog).to(TheiaIDEAboutDialog).inSingletonScope();
    } else {
        bind(AboutDialog).to(TheiaIDEAboutDialog).inSingletonScope();
    }

    bind(TheiaIDEContribution).toSelf().inSingletonScope();
    [CommandContribution, MenuContribution].forEach(serviceIdentifier =>
        bind(serviceIdentifier).toService(TheiaIDEContribution)
    );

    if (isBound(AIRegistryConfiguration)) {
        rebind(AIRegistryConfiguration).to(TheiaIDEAIRegistryConfiguration).inSingletonScope();
    } else {
        bind(AIRegistryConfiguration).to(TheiaIDEAIRegistryConfiguration).inSingletonScope();
    }
});
