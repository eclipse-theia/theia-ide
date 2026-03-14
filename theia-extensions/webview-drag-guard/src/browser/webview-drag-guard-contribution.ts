/********************************************************************************
 * Copyright (C) 2025 Eclipse Theia.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at
 * https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { injectable } from '@theia/core/shared/inversify';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';

@injectable()
export class WebviewDragGuardContribution implements FrontendApplicationContribution {

    protected static readonly BODY_CLASS = 'theia-webview-drag-guard-active';
    protected static readonly STYLE_ELEMENT_ID = 'theia-webview-drag-guard-style';
    protected static readonly HANDLE_SELECTORS = [
        '.theia-sash',
        '.theia-split-overlay-handle',
        '.theia-split-overlay',
        '.theia-dock-split-handle',
        '.theia-dockpanel-split-handle',
        '.splitview-sash',
        '.splitview-view .sash',
        '.split-view-container .sash',
        '.split-handle',
        '.p-SplitPanel-handle',
        '.lm-SplitPanel-handle',
        '.dockpanel-handle',
        '.dockpanel-sash',
        '.theia-sidebar-handle'
    ].join(', ');

    protected static readonly RESIZE_CURSORS = new Set([
        'col-resize',
        'row-resize',
        'ew-resize',
        'ns-resize',
        'nesw-resize',
        'nwse-resize'
    ]);
    protected static readonly CURSOR_CHECK_DEPTH = 4;

    protected readonly toDispose = new DisposableCollection();
    protected dragActive = false;
    protected activePointerId: number | undefined;

    onStart(): void {
        if (typeof document === 'undefined') {
            return;
        }

        this.ensureStyleElement();
        this.registerListeners();
    }

    onStop(): void {
        this.resetDrag();
        this.toDispose.dispose();
        const style = document.getElementById(WebviewDragGuardContribution.STYLE_ELEMENT_ID);
        if (style) {
            style.remove();
        }
    }

    protected registerListeners(): void {
        const pointerDown = (event: PointerEvent) => this.handlePointerDown(event);
        const pointerUp = (event: PointerEvent) => this.handlePointerEnd(event);
        const pointerCancel = (event: PointerEvent) => this.handlePointerEnd(event);
        const blur = () => this.resetDrag();
        const visibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                this.resetDrag();
            }
        };
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                this.resetDrag();
            }
        };
        const pointerMove = (event: PointerEvent) => {
            if (this.dragActive && event.buttons === 0) {
                this.resetDrag();
            }
        };

        document.addEventListener('pointerdown', pointerDown, true);
        window.addEventListener('pointerup', pointerUp, true);
        window.addEventListener('pointercancel', pointerCancel, true);
        window.addEventListener('pointermove', pointerMove, true);
        window.addEventListener('blur', blur, true);
        document.addEventListener('visibilitychange', visibilityChange, true);
        document.addEventListener('keydown', keydown, true);

        this.toDispose.push(Disposable.create(() => document.removeEventListener('pointerdown', pointerDown, true)));
        this.toDispose.push(Disposable.create(() => window.removeEventListener('pointerup', pointerUp, true)));
        this.toDispose.push(Disposable.create(() => window.removeEventListener('pointercancel', pointerCancel, true)));
        this.toDispose.push(Disposable.create(() => window.removeEventListener('pointermove', pointerMove, true)));
        this.toDispose.push(Disposable.create(() => window.removeEventListener('blur', blur, true)));
        this.toDispose.push(Disposable.create(() => document.removeEventListener('visibilitychange', visibilityChange, true)));
        this.toDispose.push(Disposable.create(() => document.removeEventListener('keydown', keydown, true)));
    }

    protected ensureStyleElement(): void {
        let style = document.getElementById(WebviewDragGuardContribution.STYLE_ELEMENT_ID) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement('style');
            style.id = WebviewDragGuardContribution.STYLE_ELEMENT_ID;
            style.textContent = this.buildStyleSheet();
            document.head.appendChild(style);
        }
    }

    protected buildStyleSheet(): string {
        const cls = WebviewDragGuardContribution.BODY_CLASS;
        return `body.${cls} .theia-webview-host,
body.${cls} .theia-webview-host iframe,
body.${cls} iframe.theia-webview,
body.${cls} iframe.webview,
body.${cls} iframe.theia-mini-browser,
body.${cls} webview,
body.${cls} .custom-editor-webview,
body.${cls} .markdown-preview-frame,
body.${cls} .monaco-editor iframe,
body.${cls} .mini-browser iframe,
body.${cls} .preview-content iframe {
    pointer-events: none !important;
}`;
    }

    protected handlePointerDown(event: PointerEvent): void {
        if (this.dragActive) {
            return;
        }
        if (event.button !== 0 && event.pointerType !== 'touch' && event.pointerType !== 'pen') {
            return;
        }
        const target = event.target instanceof Element ? event.target : undefined;
        if (!this.isSplitHandle(target)) {
            return;
        }
        this.activePointerId = event.pointerId;
        this.startDrag();
    }

    protected handlePointerEnd(event: PointerEvent): void {
        if (!this.dragActive) {
            return;
        }
        if (this.activePointerId !== undefined && event.pointerId !== this.activePointerId) {
            return;
        }
        this.resetDrag();
    }

    protected startDrag(): void {
        if (this.dragActive) {
            return;
        }
        const body = document.body;
        if (!body) {
            return;
        }
        body.classList.add(WebviewDragGuardContribution.BODY_CLASS);
        this.dragActive = true;
    }

    protected resetDrag(): void {
        if (!this.dragActive) {
            this.activePointerId = undefined;
            return;
        }
        const body = document.body;
        if (body) {
            body.classList.remove(WebviewDragGuardContribution.BODY_CLASS);
        }
        this.dragActive = false;
        this.activePointerId = undefined;
    }

    protected isSplitHandle(target: Element | undefined): boolean {
        let element: Element | undefined = target;
        while (element) {
            if (element.matches && element.matches(WebviewDragGuardContribution.HANDLE_SELECTORS)) {
                return true;
            }
            if (this.hasSplitDataAttribute(element)) {
                return true;
            }
            element = element.parentElement ?? undefined;
        }
        element = target;
        for (let depth = 0; element && depth < WebviewDragGuardContribution.CURSOR_CHECK_DEPTH; depth++) {
            const cursor = window.getComputedStyle(element).cursor;
            if (cursor && WebviewDragGuardContribution.RESIZE_CURSORS.has(cursor)) {
                return true;
            }
            element = element.parentElement ?? undefined;
        }
        return false;
    }

    protected hasSplitDataAttribute(element: Element): boolean {
        const htmlElement = element as HTMLElement;
        if (!htmlElement.dataset) {
            return false;
        }
        return 'split' in htmlElement.dataset || 'splitter' in htmlElement.dataset || 'sash' in htmlElement.dataset;
    }
}
