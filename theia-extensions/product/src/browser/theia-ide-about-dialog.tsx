/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as React from 'react';
import { AboutDialog, AboutDialogProps, ABOUT_CONTENT_CLASS } from '@theia/core/lib/browser/about-dialog';
import { injectable, inject } from '@theia/core/shared/inversify';
import { renderDocumentation, renderSourceCode, renderWhatIs } from './branding-util';
import { VSXEnvironment } from '@theia/vsx-registry/lib/common/vsx-environment';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
import { ProductAboutConfiguration } from '../common/about-config';

@injectable()
export class TheiaIDEAboutDialog extends AboutDialog {

    @inject(VSXEnvironment)
    protected readonly environment: VSXEnvironment;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    protected vscodeApiVersion: string;
    protected readonly aboutConfig: ProductAboutConfiguration;

    constructor(
        @inject(AboutDialogProps) protected readonly props: AboutDialogProps
    ) {
        super(props);
        this.aboutConfig = this.resolveAboutConfig();
    }

    protected async doInit(): Promise<void> {
        this.vscodeApiVersion = await this.environment.getVscodeApiVersion();
        super.doInit();
    }

    protected render(): React.ReactNode {
        return <div className={ABOUT_CONTENT_CLASS}>
            {this.renderContent()}
        </div>;
    }

    protected renderContent(): React.ReactNode {
        return <div className='ad-container'>
            <div className='ad-float'>
                {/* <div className='ad-logo'>
                </div> */}
                {this.renderExtensions()}
            </div>
            {this.renderTitle()}
            <hr className='gs-hr' />
            <div className='flex-grid'>
                <div className='col'>
                    {renderWhatIs(this.windowService)}
                </div>
            </div>
            {/* <div className='flex-grid'>
                <div className='col'>
                    {renderSupport(this.windowService)}
                </div>
            </div> */}
            {/* <div className='flex-grid'>
                <div className='col'>
                    {renderTickets(this.windowService)}
                </div>
            </div> */}
            <div className='flex-grid'>
                <div className='col'>
                    {renderSourceCode(this.windowService)}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {renderDocumentation(this.windowService)}
                </div>
            </div>
            {/* <div className='flex-grid'>
                <div className='col'>
                    {renderDownloads()}
                </div>
            </div> */}
        </div>;

    }

    protected renderTitle(): React.ReactNode {
        return <div className='gs-header'>
            <h1>INTERLIS <span className='gs-blue-header'>IDE</span></h1>
            {this.renderVersion()}
        </div>;
    }

    protected renderVersion(): React.ReactNode {
        const applicationVersion = this.applicationInfo?.version;
        const configuredVersionLabel = this.aboutConfig.productVersionLabel;
        const displayVersionLabel = this.resolveVersionLabel(configuredVersionLabel, applicationVersion);
        const shouldAppendApplicationVersion = Boolean(applicationVersion && displayVersionLabel && !displayVersionLabel.includes(applicationVersion));
        const versionLine = displayVersionLabel ?? 'Version information unavailable';
        const baseLine = 'Based on Theia IDE v1.69.0 / Theia v1.69.0';
        const copyrightLine = this.aboutConfig.copyright ?? 'Copyright (c) 2025 Amt für Geoinformation, Kanton Solothurn';
        return <div>
            <p className='gs-sub-header' >
                {shouldAppendApplicationVersion ? `${versionLine} (${applicationVersion})` : versionLine}
            </p>
            <p className='gs-sub-header' >
                {baseLine}
            </p>
            <p className='gs-sub-header' >
                {copyrightLine}
            </p>
            <p className='gs-sub-header' >
                {'VS Code API Version: ' + this.vscodeApiVersion}
            </p>
        </div>;
    }

    protected resolveVersionLabel(configuredLabel: string | undefined, applicationVersion: string | undefined): string | undefined {
        if (configuredLabel?.includes('{version}') && applicationVersion) {
            return configuredLabel.replace(/\{version\}/g, applicationVersion);
        }
        if (configuredLabel && configuredLabel.trim().length > 0) {
            return configuredLabel;
        }
        if (applicationVersion) {
            return `Version ${applicationVersion}`;
        }
        return undefined;
    }

    protected resolveAboutConfig(): ProductAboutConfiguration {
        const config = FrontendApplicationConfigProvider.get() as { about?: ProductAboutConfiguration };
        return config.about ?? {};
    }
}

export namespace TheiaIDEAboutDialog { }
