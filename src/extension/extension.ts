import * as vscode from "vscode";
import { PrReviewerPanelProvider, PR_REVIEWER_VIEW_ID } from "./panelProvider.js";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("PR Reviewer");
  const panelProvider = new PrReviewerPanelProvider(outputChannel);
  outputChannel.appendLine(`[startup] PR Reviewer activated at ${new Date().toISOString()}`);

  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PR_REVIEWER_VIEW_ID, panelProvider, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("prReviewer.openPanel", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.prReviewer");
      try {
        await vscode.commands.executeCommand(`${PR_REVIEWER_VIEW_ID}.focus`);
      } catch {
        panelProvider.reveal();
      }
    })
  );
}

export function deactivate(): void {
  // no-op
}
