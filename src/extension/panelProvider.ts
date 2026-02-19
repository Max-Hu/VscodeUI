import * as vscode from "vscode";
import { loadStage1ConfigPatchFromVsCodeSettings } from "../config/vscodeSettings.js";
import type { Stage1ConfigPatch } from "../config/types.js";
import { Stage1ReviewOrchestrator } from "../orchestrator/reviewOrchestrator.js";
import { createPanelProviderSet } from "../providers/panelProviderFactory.js";
import type { PanelInboundMessage } from "../views/panelContracts.js";
import { getNonce, getPanelHtml } from "./panelHtml.js";
import { routePanelMessage } from "./panelMessageRouter.js";

export const PR_REVIEWER_VIEW_ID = "prReviewer.panel";
export const PR_REVIEWER_SETTINGS_SECTION = "prReviewer";

export class PrReviewerPanelProvider implements vscode.WebviewViewProvider {
  private webviewView: vscode.WebviewView | undefined;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    webviewView.webview.html = getPanelHtml(getNonce());
    webviewView.webview.onDidReceiveMessage((message: PanelInboundMessage) => {
      void this.handleInboundMessage(message);
    });
  }

  reveal(): void {
    this.webviewView?.show(true);
  }

  private async handleInboundMessage(message: unknown): Promise<void> {
    const outbound = await routePanelMessage(message, {
      runReview: async (request) => {
        const orchestrator = await this.createOrchestrator();
        return orchestrator.run(request);
      },
      publishEditedComment: async (request) => {
        const orchestrator = await this.createOrchestrator();
        return orchestrator.publishEditedComment(request);
      }
    });

    await this.webviewView?.webview.postMessage(outbound);
  }

  private async createOrchestrator(): Promise<Stage1ReviewOrchestrator> {
    let configPatch: Stage1ConfigPatch = {};
    try {
      configPatch = await loadStage1ConfigPatchFromVsCodeSettings(PR_REVIEWER_SETTINGS_SECTION);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load VS Code settings.";
      void vscode.window.showWarningMessage(`PR Reviewer settings fallback to defaults: ${message}`);
    }
    const useDemoData = vscode.workspace
      .getConfiguration(PR_REVIEWER_SETTINGS_SECTION)
      .get<boolean>("providers.useDemoData", true);
    const disableTlsValidation = vscode.workspace
      .getConfiguration(PR_REVIEWER_SETTINGS_SECTION)
      .get<boolean>("providers.disableTlsValidation", false);
    const providers = createPanelProviderSet({
      useDemoData,
      disableTlsValidation,
      configPatch
    });

    return new Stage1ReviewOrchestrator({
      githubProvider: providers.githubProvider,
      jiraProvider: providers.jiraProvider,
      confluenceProvider: providers.confluenceProvider,
      config: configPatch
    });
  }
}
