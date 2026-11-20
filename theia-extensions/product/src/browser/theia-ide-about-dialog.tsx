/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as React from '@theia/core/shared/react';
import { AboutDialog, AboutDialogProps, ABOUT_CONTENT_CLASS, ABOUT_EXTENSIONS_CLASS } from '@theia/core/lib/browser/about-dialog';
import { codicon, Message } from '@theia/core/lib/browser';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { injectable, inject } from '@theia/core/shared/inversify';
import { environment } from '@theia/core/lib/common';
import { DEFAULT_SUPPORTED_MONACO_VERSION } from '@theia/core/shared/@theia/application-package/lib/api';
import { renderBrandingSections, renderProductName } from './branding-util.js';
import { VersionInfo, VersionsService } from '../common/versions-service.js';
import { VSXEnvironment } from '@theia/vsx-registry/lib/common/vsx-environment';
import { WindowService } from '@theia/core/lib/browser/window/window-service';

const COPY_LABEL = 'Copy Version Information';
const COPIED_LABEL = 'Copied';
const COPY_FAILED_LABEL = 'Copy Failed';
const COPIED_FEEDBACK_MS = 2000;

/** Checked in order, because Chromium based browsers also carry `Chrome/` and `Safari/` in their user agent. */
const KNOWN_BROWSERS: { name: string, pattern: RegExp }[] = [
    { name: 'Edge', pattern: /Edg\/([\d.]+)/ },
    { name: 'Opera', pattern: /OPR\/([\d.]+)/ },
    { name: 'Firefox', pattern: /Firefox\/([\d.]+)/ },
    { name: 'Chrome', pattern: /Chrome\/([\d.]+)/ },
    { name: 'Safari', pattern: /Version\/([\d.]+).*Safari\// }
];

/** A browser brand with its full version, as reported by the User-Agent Client Hints API. */
export interface BrowserBrand {
    brand: string;
    version: string;
}

/** The part of `navigator.userAgentData` used here. It is not part of the DOM typings yet. */
interface NavigatorUAData {
    getHighEntropyValues(hints: string[]): Promise<{ fullVersionList?: BrowserBrand[] }>;
}

/** The placeholder brands Chromium mixes in, e.g. `Not)A;Brand`, so that nobody relies on the order. */
const GREASE_BRAND = /not.?a.?brand/i;

export interface VersionDetail {
    label: string;
    value: string;
}

@injectable()
export class TheiaIDEAboutDialog extends AboutDialog {

    @inject(VSXEnvironment)
    protected readonly environment: VSXEnvironment;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(VersionsService)
    protected readonly versionsService: VersionsService;

    @inject(ClipboardService)
    protected readonly clipboardService: ClipboardService;

    protected vscodeApiVersion: string;
    protected versionInfo: VersionInfo | undefined;
    protected browserBrands: BrowserBrand[] | undefined;
    protected copyButton: HTMLButtonElement;

    constructor(
        @inject(AboutDialogProps) protected readonly props: AboutDialogProps
    ) {
        super(props);
        /*
         * The control panel is where Theia dialogs keep their actions, so `Copy` belongs there next to `OK`
         * rather than in the content. It is placed relative to the accept button, because the first child of
         * the control panel is the error message node, whose `flex: 2` would push anything ahead of it to the
         * far left.
         */
        this.copyButton = this.appendButton(COPY_LABEL, false);
        this.acceptButton?.before(this.copyButton);
    }

    /**
     * Wired up on every attach, like the accept and close buttons of the base dialog: listeners added with
     * `addEventListener` go away when the dialog closes, and core reuses the same About dialog instance.
     */
    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.addEventListener(this.copyButton, 'click', this.doCopyVersionDetails);
    }

    protected async doInit(): Promise<void> {
        [this.vscodeApiVersion, this.versionInfo, this.browserBrands] = await Promise.all([
            this.environment.getVscodeApiVersion(),
            // The dialog stays usable without the runtime versions, so a failing backend only costs those rows.
            this.versionsService.getVersions().catch(() => undefined),
            this.getBrowserBrands()
        ]);
        await super.doInit();
    }

    protected render(): React.ReactNode {
        return <div className={ABOUT_CONTENT_CLASS}>
            {this.renderContent()}
        </div>;
    }

    /**
     * A header across the top, then two columns: the version information and the product description on
     * the left, the extensions on the right. Each column scrolls on its own, so the extension list stays
     * in view next to the text.
     */
    protected renderContent(): React.ReactNode {
        return <div className='ad-container'>
            {this.renderTitle()}
            <div className='ad-main-column'>
                {this.renderVersion()}
                {renderBrandingSections({
                    windowService: this.windowService
                })}
            </div>
            <div className='ad-side-column'>
                {this.renderExtensions()}
            </div>
        </div>;
    }

    /** The same header as on the welcome page, so that both read as the same product. */
    protected renderTitle(): React.ReactNode {
        return <div className='gs-header tide-welcome-header ad-header'>
            <div className='theia-icon tide-welcome-icon'>
            </div>
            {renderProductName()}
        </div>;
    }

    protected renderVersion(): React.ReactNode {
        return <div className='gs-section'>
            <h3 className='gs-section-header'>
                <i className={codicon('versions')}></i>
                Version Information
            </h3>
            <dl className='ad-version-table'>
                {this.collectVersionDetails().map(({ label, value }) =>
                    <React.Fragment key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                    </React.Fragment>
                )}
            </dl>
        </div>;
    }

    /** With a section header like the other sections rather than the plain heading of the base dialog. */
    protected renderExtensions(): React.ReactNode {
        const extensions = [...this.extensionsInfos].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        return <div className='gs-section ad-extensions'>
            <h3 className='gs-section-header'>
                <i className={codicon('package')}></i>
                Theia Extensions
            </h3>
            <ul className={ABOUT_EXTENSIONS_CLASS}>
                {extensions.map(extension =>
                    <li key={extension.name}>
                        <span>{extension.name}</span>
                        <span className='ad-extension-version'>{extension.version}</span>
                    </li>
                )}
            </ul>
        </div>;
    }

    /**
     * The versions to show. Every row describes the machine the user sits at: the desktop build lists its
     * Electron runtime and OS, a browser deployment lists the browser, because the backend there runs on a
     * server the user neither sees nor controls. Entries without a value are left out.
     */
    protected collectVersionDetails(): VersionDetail[] {
        const details: VersionDetail[] = [];
        const add = (label: string, value: string | undefined) => {
            if (value) {
                details.push({ label, value });
            }
        };
        add('Version', this.applicationInfo?.version);
        add('VS Code API', this.vscodeApiVersion);
        // The version the framework declares support for, which is the one this application resolves.
        add('Monaco Editor', DEFAULT_SUPPORTED_MONACO_VERSION);
        if (environment.electron.is()) {
            add('Electron', this.versionInfo?.electron);
            // The renderer is the Chromium that ships with Electron.
            add('Chromium', this.browserBrands?.find(({ brand }) => brand === 'Chromium')?.version
                ?? navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1]);
            add('Node.js', this.versionInfo?.node);
            add('V8', this.versionInfo?.v8);
            add('OS', this.versionInfo?.os);
        } else {
            add('Browser', this.getBrowserVersion());
        }
        return details;
    }

    /**
     * Chromium based browsers report only the major version in the user agent, e.g. `Chrome/158.0.0.0`, and
     * give out the full one through User-Agent Client Hints instead. Firefox and Safari have no such API but
     * still report their real version in the user agent. The API also needs a secure context, so a
     * deployment served over plain HTTP falls back to the user agent as well.
     */
    protected async getBrowserBrands(): Promise<BrowserBrand[] | undefined> {
        const userAgentData = (navigator as { userAgentData?: NavigatorUAData }).userAgentData;
        try {
            return (await userAgentData?.getHighEntropyValues(['fullVersionList']))?.fullVersionList;
        } catch {
            return undefined;
        }
    }

    /** The browser name and version, or the raw user agent for a browser it does not recognize. */
    protected getBrowserVersion(): string {
        // The browser's own brand, e.g. `Google Chrome`, is more telling than the `Chromium` engine below it.
        const brands = this.browserBrands?.filter(({ brand }) => !GREASE_BRAND.test(brand));
        const ownBrand = brands?.find(({ brand }) => brand !== 'Chromium') ?? brands?.[0];
        if (ownBrand) {
            return `${ownBrand.brand} ${ownBrand.version}`;
        }
        const userAgent = navigator.userAgent;
        for (const { name, pattern } of KNOWN_BROWSERS) {
            const version = userAgent.match(pattern)?.[1];
            if (version) {
                return `${name} ${version}`;
            }
        }
        return userAgent;
    }

    protected doCopyVersionDetails = async () => {
        const text = this.collectVersionDetails().map(({ label, value }) => `${label}: ${value}`).join('\n');
        const copied = await this.writeToClipboard(text);
        this.copyButton.textContent = copied ? COPIED_LABEL : COPY_FAILED_LABEL;
        window.setTimeout(() => this.copyButton.textContent = COPY_LABEL, COPIED_FEEDBACK_MS);
    };

    /**
     * The clipboard service does not tell whether it succeeded: in a browser it logs a failure and returns as
     * usual. Its `onDidWriteText` event does tell, so the button only claims success after that event. A
     * service without the event reports a failure by throwing.
     */
    protected async writeToClipboard(text: string): Promise<boolean> {
        let written = false;
        const listener = this.clipboardService.onDidWriteText?.(value => written = written || value === text);
        try {
            await this.clipboardService.writeText(text);
            return written || !listener;
        } catch {
            return false;
        } finally {
            listener?.dispose();
        }
    }
}
