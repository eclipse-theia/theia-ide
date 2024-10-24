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

export interface ExternalBrowserLinkProps {
    text: string;
    url: string;
    windowService: WindowService;
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
            The Eclipse Theia IDE is a modern and open IDE for cloud and desktop. The Theia IDE is based on the <BrowserLink text="Theia platform"
            url="https://theia-ide.org" windowService={windowService} ></BrowserLink>.
        </div>
        <div>
            The IDE is available as a <BrowserLink text="downloadable desktop application" url="https://theia-ide.org//#theiaidedownload"
            windowService={windowService} ></BrowserLink>. You can also <BrowserLink text="try the latest version of the Theia IDE online"
            url="https://try.theia-cloud.io/" windowService={windowService} ></BrowserLink>. The online test version is limited to 30 minutes per session and hosted
            via <BrowserLink text="Theia Cloud" url="https://theia-cloud.io/" windowService={windowService} ></BrowserLink>.
        </div>
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
            The features in the Eclipse Theia IDE are based on Theia and the included
            extensions/plugins. For bugs in Theia please consider opening an issue in
            the <BrowserLink text="Theia project on Github" url="https://github.com/eclipse-theia/theia/issues/new/choose"
                windowService={windowService} ></BrowserLink>.
        </div>
        <div>
            Eclipse Theia IDE only packages existing functionality into a product and installers
            for the product. If you believe there is a mistake in packaging, something needs to be added to the
            packaging or the installers do not work properly,
            please <BrowserLink text="open an issue on Github" url="https://github.com/eclipse-theia/theia-ide/issues/new/choose"
                windowService={windowService} ></BrowserLink> to let us know.
        </div>
    </div>;
}

export function renderSourceCode(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Source Code
        </h3>
        <div >
            The source code of Eclipse Theia IDE is available
            on <BrowserLink text="Github" url="https://github.com/eclipse-theia/theia-ide"
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
            Please see the <BrowserLink text="documentation" url="https://theia-ide.org/docs/user_getting_started/"
            windowService={windowService} ></BrowserLink> on how to use the Theia IDE.
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
            You can update Eclipse Theia IDE directly in this application by navigating to
            File {'>'} Preferences {'>'} Check for Updates… Moreover the application will check for updates
            after each launch automatically.
        </div>
        <div className='gs-action-container'>
            Alternatively you can download the most recent version from the download page.
        </div>
    </div>;
}
