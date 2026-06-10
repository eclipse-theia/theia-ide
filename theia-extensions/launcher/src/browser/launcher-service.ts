/********************************************************************************
 * Copyright (C) 2022 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { Endpoint } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

export type LauncherEndpointState = 'up-to-date' | 'needs-silent-update' | 'needs-prompt';

@injectable()
export class LauncherService {

    async getState(uriScheme: string): Promise<LauncherEndpointState> {
        const params = new URLSearchParams({ uriScheme });
        const response = await fetch(new Request(`${this.endpoint()}/state?${params}`), { method: 'GET' }).then(r => r.json());
        return response?.state ?? 'needs-prompt';
    }

    async createLauncher(create: boolean, uriScheme: string): Promise<void> {
        await fetch(new Request(`${this.endpoint()}`), {
            body: JSON.stringify({ create, uriScheme }),
            method: 'PUT',
            headers: new Headers({ 'Content-Type': 'application/json' })
        });
    }

    protected endpoint(): string {
        const url = new Endpoint({ path: 'launcher' }).getRestUrl().toString();
        return url.endsWith('/') ? url.slice(0, -1) : url;
    }
}
