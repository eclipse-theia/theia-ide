/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as React from 'react';

import { PreferenceService } from '@theia/core/lib/common';
import { inject, injectable } from '@theia/core/shared/inversify';
import { renderBrandingSections, renderProductName } from './branding-util';

import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { VSXEnvironment } from '@theia/vsx-registry/lib/common/vsx-environment';
import { WindowService } from '@theia/core/lib/browser/window/window-service';

@injectable()
export class TheiaIDEGettingStartedWidget extends GettingStartedWidget {

    @inject(VSXEnvironment)
    protected readonly vsxEnvironment: VSXEnvironment;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(PreferenceService)
    protected readonly preferenceService: PreferenceService;

    protected vscodeApiVersion: string;

    protected async doInit(): Promise<void> {
        super.doInit();
        this.vscodeApiVersion = await this.vsxEnvironment.getVscodeApiVersion();
        await this.preferenceService.ready;
        this.update();
    }

    protected render(): React.ReactNode {
        if (this.walkthroughService.selectedWalkthrough) {
            return this.renderSelectedWalkthrough();
        }
        return <div className='gs-container'>
            <div className='gs-content-container'>
                {this.renderHeader()}
                <hr className='gs-hr' />
                {this.aiIsIncluded &&
                    <div className='tide-welcome-banner'>
                        {this.renderAIBanner()}
                    </div>
                }
                <div className='tide-welcome-grid'>
                    <div className='tide-welcome-column'>
                        {this.renderStart()}
                        {this.renderRecentWorkspaces()}
                        {this.renderWalkthroughs()}
                        {this.renderSettings()}
                        {this.renderHelp()}
                    </div>
                    <div className='tide-welcome-column'>
                        {renderBrandingSections({
                            windowService: this.windowService
                        })}
                    </div>
                </div>
            </div>
            <div className='gs-preference-container'>
                {this.renderPreferences()}
            </div>
        </div>;
    }

    /**
     * The square application icon is used rather than the wordmark logo: it carries the brand without
     * repeating the product name next to it, and the same box fits every branding variant.
     */
    protected renderHeader(): React.ReactNode {
        return <div className='gs-header tide-welcome-header'>
            <div className='theia-icon tide-welcome-icon'>
            </div>
            <div>
                {renderProductName()}
                {this.renderVersion()}
            </div>
        </div>;
    }

    /**
     * Both versions go on a single line, so that the header stays as flat as the sections below it.
     */
    protected renderVersion(): React.ReactNode {
        return <p className='gs-sub-header'>
            {'Version ' + (this.applicationInfo?.version ?? '-') + ' · VS Code API ' + (this.vscodeApiVersion ?? '-')}
        </p>;
    }
}
