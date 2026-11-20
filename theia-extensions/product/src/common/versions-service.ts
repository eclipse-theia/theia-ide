/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

export const VERSIONS_SERVICE_PATH = '/services/theia-ide-versions';

export const VersionsService = Symbol('VersionsService');

/**
 * Runtime version information about the desktop application. It is empty in a browser deployment, where
 * the backend runs on a server: its versions would not describe the user's environment, and the operator
 * may not want to expose them to every user.
 */
export interface VersionInfo {
    electron?: string;
    node?: string;
    v8?: string;
    os?: string;
}

/**
 * Provides the runtime versions of the desktop application. The frontend has no access to them, so they are
 * read in the backend and served over RPC.
 */
export interface VersionsService {
    getVersions(): Promise<VersionInfo>;
}
