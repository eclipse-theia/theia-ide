/********************************************************************************
 * Copyright (C) 2024 STMicroelectronics and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { Endpoint } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

export type DesktopFileState = 'up-to-date' | 'needs-silent-update' | 'needs-prompt';

export interface DesktopFileOptions {
    applicationName: string;
    uriScheme: string;
    createUrlHandler?: boolean;
}

@injectable()
export class DesktopFileService {

    async getState(options: DesktopFileOptions): Promise<DesktopFileState> {
        const params = new URLSearchParams({
            applicationName: options.applicationName,
            uriScheme: options.uriScheme
        });
        const response = await fetch(new Request(`${this.endpoint()}/state?${params}`), { method: 'GET' }).then(r => r.json());
        return response?.state ?? 'needs-prompt';
    }

    async createOrUpdateDesktopfile(create: boolean, options: DesktopFileOptions): Promise<void> {
        fetch(new Request(`${this.endpoint()}`), {
            body: JSON.stringify({ create, ...options }),
            method: 'PUT',
            headers: new Headers({ 'Content-Type': 'application/json' })
        });
    }

    protected endpoint(): string {
        const url = new Endpoint({ path: 'desktopfile' }).getRestUrl().toString();
        return url.endsWith('/') ? url.slice(0, -1) : url;
    }
}
