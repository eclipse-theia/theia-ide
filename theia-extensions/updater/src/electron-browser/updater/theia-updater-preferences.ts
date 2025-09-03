/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';

export const theiaUpdaterPreferenceSchema: PreferenceSchema = {
    'properties': {
        'updates.reportOnStart': {
            type: 'boolean',
            description: 'Report available updates after application start.',
            default: true
        },
        'updates.channel': {
            type: 'string',
            enum: ['stable', 'preview'], // once we have a nightly/next build, we can add a third channel
            default: 'stable'
        },
    }
};
