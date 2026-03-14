/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { WindowService } from '@theia/core/lib/browser/window/window-service';
import * as React from 'react';
import { getBrandingVariant } from './theia-ide-config';

export interface ExternalBrowserLinkProps {
    text: string;
    url: string;
    windowService?: WindowService;
}

export function renderProductName(): React.ReactNode {
    const variant = getBrandingVariant();
    const suffix = variant !== 'stable' ? ` ${variant.charAt(0).toUpperCase() + variant.slice(1)}` : '';
    return <h1>INTERLIS <span className="gs-blue-header">IDE</span>{suffix}</h1>;
}

function BrowserLink(props: ExternalBrowserLinkProps): JSX.Element {
    return <a
        role={'button'}
        tabIndex={0}
        href={props.url}
        target='_blank'
        >
        {props.text}
    </a>;
}

export function renderWhatIs(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            What is this?
        </h3>
        <div>
            The INTERLIS IDE streamlines schema modeling, validation, and documentation tasks across desktop platforms.
            The Java-based language server powers smart authoring tools while the IDE keeps teams productive with familiar editor ergonomics.

            The INTERLIS IDE is based on the <BrowserLink text="Theia platform"
            url="https://theia-ide.org" windowService={windowService} ></BrowserLink>.
        </div>
        {/* <div>
            The IDE is available as a <BrowserLink text="downloadable desktop application" url="https://theia-ide.org//#theiaidedownload"
            windowService={windowService} ></BrowserLink>. You can also <BrowserLink text="try the latest version of the Theia IDE online"
            url="https://try.theia-cloud.io/" windowService={windowService} ></BrowserLink>. The online test version is limited to 30 minutes per session and hosted
            via <BrowserLink text="Theia Cloud" url="https://theia-cloud.io/" windowService={windowService} ></BrowserLink>.
        </div> */}
    </div>;
}

export function renderExtendingCustomizing(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Extending/Customizing the Theia IDE
        </h3>
        <div >
            You can extend the Theia IDE at runtime by installing VS Code extensions, e.g. from the <BrowserLink text="OpenVSX registry" url="https://open-vsx.org/"
            windowService={windowService} ></BrowserLink>, an open marketplace for VS Code extensions. Just open the extension view or browse <BrowserLink
            text="OpenVSX online" url="https://open-vsx.org/" windowService={windowService} ></BrowserLink>.
        </div>
        <div>
            Furthermore, the Theia IDE is based on the flexible Theia platform. Therefore, the Theia IDE can serve as a <span className='gs-text-bold'>template</span> for building
            custom tools and IDEs. Browse <BrowserLink text="the documentation" url="https://theia-ide.org/docs/composing_applications/"
            windowService={windowService} ></BrowserLink> to help you customize and build your own Eclipse Theia-based product.
        </div>
    </div>;
}

export function renderSupport(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Professional Support
        </h3>
        <div>
            Professional support, implementation services, consulting and training for building tools like Theia IDE and for building other tools based on Eclipse Theia is
            available by selected companies as listed on the <BrowserLink text=" Theia support page" url="https://theia-ide.org/support/"
            windowService={windowService} ></BrowserLink>.
        </div>
    </div>;
}

export function renderTickets(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Reporting feature requests and bugs
        </h3>
        <div >
            The INTERLIS IDE combines the Theia platform with INTERLIS-specific tooling and packaging.
            Please start by reporting IDE, installer, and editor issues in the
            <BrowserLink text=" INTERLIS Editor issue tracker" url="https://github.com/edigonzales/interlis-lsp/issues/new?assignees=&labels=&template="
                windowService={windowService} ></BrowserLink>.
        </div>
        <div>
            For usage questions and known workflows, the
            <BrowserLink text=" INTERLIS IDE documentation" url="https://interlis-ide.ch/docs/intro"
                windowService={windowService} ></BrowserLink> is the primary reference.
        </div>
    </div>;
}

export function renderSourceCode(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Source Code
        </h3>
        <div >
            The source code of INTERLIS IDE is available
            on <BrowserLink text="Github" url="https://github.com/edigonzales/interlis-ide"
                windowService={windowService} ></BrowserLink>.
        </div>
    </div>;
}

export function renderDocumentation(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Documentation
        </h3>
        <div >
            Please see the <BrowserLink text="documentation" url="https://interlis-ide.ch/docs/intro"
            windowService={windowService} ></BrowserLink> on how to use the INTERLIS IDE.
        </div>
    </div>;
}

export function renderCollaboration(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Collaboration
        </h3>
        <div >
            The IDE features a built-in collaboration feature.
            You can share your workspace with others and work together in real-time by clicking on the <i>Collaborate</i> item in the status bar.
            The collaboration feature is powered by
            the <BrowserLink text="Open Collaboration Tools" url="https://www.open-collab.tools/" windowService={windowService} /> project
            and uses their public server infrastructure.
        </div>
    </div>;
}

export function renderDownloads(): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Updates and Downloads
        </h3>
        <div className='gs-action-container'>
            You can update INTERLIS IDE directly in this application by navigating to
            File {'>'} Preferences {'>'} Check for Updates… The application checks the stable release channel automatically after launch.
        </div>
        <div className='gs-action-container'>
            Alternatively you can download the most recent version from
            <BrowserLink text=" GitHub Releases" url="https://github.com/edigonzales/interlis-ide/releases/latest" />.
        </div>
    </div>;
}
