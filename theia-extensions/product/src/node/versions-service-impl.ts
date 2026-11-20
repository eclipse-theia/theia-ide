/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as os from 'os';

import { injectable } from '@theia/core/shared/inversify';
import { VersionInfo, VersionsService } from '../common/versions-service.js';

@injectable()
export class VersionsServiceImpl implements VersionsService {

    async getVersions(): Promise<VersionInfo> {
        const versions = process.versions;
        /*
         * The backend is forked from the Electron main process, which does not pass its own versions on.
         * The generated backend fills `process.versions.electron` in from `THEIA_ELECTRON_VERSION`, see
         * `applications/electron/src-gen/backend/server.js`. Without it this is a browser deployment, whose
         * server details are not exposed, see `VersionInfo`.
         */
        if (!versions.electron) {
            return {};
        }
        return {
            electron: versions.electron,
            node: versions.node,
            v8: versions.v8,
            os: `${os.type()} ${os.arch()} ${os.release()}`
        };
    }
}
