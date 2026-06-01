/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { AIRegistryConfiguration } from '@theia/ai-registry/lib/common/ai-registry-configuration';
import { injectable } from '@theia/core/shared/inversify';
import { getBrandingVariant } from './theia-ide-config';

@injectable()
export class TheiaIDEAIRegistryConfiguration extends AIRegistryConfiguration {
    override getToolName(): string {
        return getBrandingVariant() === 'next' ? 'theia-ide-next' : 'theia-ide';
    }
}
