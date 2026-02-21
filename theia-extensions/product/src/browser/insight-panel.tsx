import { injectable, inject, postConstruct, interfaces } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser';
import * as React from '@theia/core/shared/react';
import { ApplicationShellWithToolbarOverride } from '@theia/toolbar/lib/browser/application-shell-with-toolbar-override';

import {
    ApplicationShell,
    Layout,
    TheiaSplitPanel,
    WidgetFactory,
} from '@theia/core/lib/browser';
import { ChatService } from '@theia/ai-chat';

export const ChatServiceFactory = Symbol('ChatServiceFactory ');

@injectable()
export class InsightPanel extends ReactWidget {
    public static readonly PANEL_ID = 'insight-panel';
    private static readonly PANEL_CLASS = 'insight-panel';
    private static readonly PANEL_TITLE = 'Insight Panel';

    @inject(ChatServiceFactory) chatService: () => ChatService;


    @postConstruct()
    protected initialize(): void {
        this.id = InsightPanel.PANEL_ID;
        this.addClass(InsightPanel.PANEL_CLASS);
        this.title.label = InsightPanel.PANEL_TITLE;
        this.title.closable = true;

        console.log(this.chatService().getSessions());

        this.update();
    }

    protected override render(): React.ReactNode {
        return <div>Hello, world!</div>;
    }
}

@injectable()
export class ApplicationShellWithToolbarOverridePatch extends ApplicationShellWithToolbarOverride {
    @inject(InsightPanel) protected readonly agenticPanel: InsightPanel;  
  
    protected override createLayout(): Layout {  
        const bottomSplitLayout = this.createSplitLayout(  
            [this.mainPanel, this.bottomPanel],  
            [1, 0],  
            { orientation: 'vertical', spacing: 0 }  
        );  
        const panelForBottomArea = new TheiaSplitPanel({ layout: bottomSplitLayout });  
        panelForBottomArea.id = 'theia-bottom-split-panel';  
    
        const leftRightSplitLayout = this.createSplitLayout(  
            [this.leftPanelHandler.container, this.agenticPanel, panelForBottomArea, this.rightPanelHandler.container],  
            [0, 0, 1, 0],  
            { orientation: 'horizontal', spacing: 0 }  
        );  
        const panelForSideAreas = new TheiaSplitPanel({ layout: leftRightSplitLayout });  
        panelForSideAreas.id = 'theia-left-right-split-panel';  
  
        return this.createBoxLayout(  
            [panelForSideAreas, this.statusBar],  
            [1, 0],  
            { direction: 'top-to-bottom', spacing: 0 }  
        );  
    }  
}

export const bindInsightPanel = (bind: interfaces.Bind, rebind: interfaces.Rebind) => {

    bind(ChatServiceFactory ).toFactory(ctx => () => ctx.container.get(ChatService));


    bind(ApplicationShellWithToolbarOverridePatch).toSelf().inSingletonScope();  
    rebind(ApplicationShell).toService(ApplicationShellWithToolbarOverridePatch);
    bind(InsightPanel).toSelf().inSingletonScope();
    bind(WidgetFactory)
        .toDynamicValue(({ container }) => ({
            id: InsightPanel.PANEL_ID,
            createWidget: () => container.get(InsightPanel),
        }))
    .inSingletonScope();
}