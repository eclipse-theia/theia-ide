/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { PreferenceSchema, PreferenceScope } from '@theia/core';

export const theiaUpdaterPreferenceSchema: PreferenceSchema = {
    'properties': {
        'updates.checkForUpdates': {
            type: 'boolean',
            description: 'Automatically check for updates.',
            default: true,
            scope: PreferenceScope.User
        },
        'updates.checkInterval': {
            type: 'number',
            description: 'Interval in minutes between automatic update checks.',
            default: 60,
            scope: PreferenceScope.User
        },
        'updates.channel': {
            type: 'string',
            enum: ['stable', 'preview'],
            description: 'Channel to use for updates.',
            default: 'stable',
            scope: PreferenceScope.User
        },
    }
};
