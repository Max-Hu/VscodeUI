import * as vscode from "vscode";
import { PR_REVIEWER_DIFF_SCHEME, PrReviewerPanelProvider, PR_REVIEWER_VIEW_ID } from "./panelProvider.js";
import {
  PR_REVIEWER_DIFF_TREE_VIEW_ID,
  PR_REVIEWER_OPEN_ALL_DIFFS_FROM_TREE_COMMAND,
  PR_REVIEWER_OPEN_DIFF_FROM_TREE_COMMAND,
  PrDiffTreeProvider
} from "./prDiffTreeProvider.js";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("PR Reviewer");
  const prDiffTreeProvider = new PrDiffTreeProvider();
  const panelProvider = new PrReviewerPanelProvider(outputChannel, prDiffTreeProvider);
  outputChannel.appendLine(`[startup] PR Reviewer activated at ${new Date().toISOString()}`);

  context.subscriptions.push(outputChannel);
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(PR_REVIEWER_DIFF_SCHEME, panelProvider));
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(PR_REVIEWER_DIFF_TREE_VIEW_ID, prDiffTreeProvider)
  );

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

  context.subscriptions.push(
    vscode.commands.registerCommand(PR_REVIEWER_OPEN_DIFF_FROM_TREE_COMMAND, async (prLink: unknown, filePath: unknown) => {
      if (typeof prLink !== "string" || typeof filePath !== "string") {
        return;
      }
      try {
        await panelProvider.openPrDiffFileFromTree(prLink, filePath);
      } catch {
        // panel provider already emitted status/error messaging
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(PR_REVIEWER_OPEN_ALL_DIFFS_FROM_TREE_COMMAND, async (prLink: unknown) => {
      if (typeof prLink !== "string") {
        return;
      }
      try {
        await panelProvider.openAllPrDiffFilesFromTree(prLink);
      } catch {
        // panel provider already emitted status/error messaging
      }
    })
  );
}

export function deactivate(): void {
  // no-op
}
