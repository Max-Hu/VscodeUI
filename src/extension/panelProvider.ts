import * as vscode from "vscode";
import { loadStage1ConfigPatchFromVsCodeSettings } from "../config/vscodeSettings.js";
import type { Stage1ConfigPatch } from "../config/types.js";
import { CopilotLlmProvider, listCopilotChatModels } from "../llm/copilotLlmProvider.js";
import { PanelReviewObserver } from "../observability/panelReviewObserver.js";
import type { ReviewEvent } from "../observability/reviewObserver.js";
import { Stage1ReviewOrchestrator } from "../orchestrator/reviewOrchestrator.js";
import { createPanelProviderSet } from "../providers/panelProviderFactory.js";
import type { PanelInboundMessage, PanelOutboundMessage } from "../views/panelContracts.js";
import { getNonce, getPanelHtml } from "./panelHtml.js";
import { routePanelMessage } from "./panelMessageRouter.js";

export const PR_REVIEWER_VIEW_ID = "prReviewer.panel";
export const PR_REVIEWER_SETTINGS_SECTION = "prReviewer";

export class PrReviewerPanelProvider implements vscode.WebviewViewProvider {
  private webviewView: vscode.WebviewView | undefined;

  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    this.outputChannel.appendLine(`[panel] webview resolved at ${new Date().toISOString()}`);
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
    const verboseLogs = this.isVerboseLogsEnabled();
    if (verboseLogs) {
      this.outputChannel.show(false);
    }
    const messageType =
      message && typeof message === "object" && "type" in message ? String((message as { type: unknown }).type) : "unknown";
    this.outputChannel.appendLine(`[panel] inbound message received: ${messageType}`);
    if (verboseLogs) {
      this.outputChannel.appendLine(`[panel] inbound payload: ${safeStringify(message)}`);
    }
    if (isListCopilotModelsMessage(message)) {
      await this.postCopilotModels();
      return;
    }
    const outbound = await routePanelMessage(message, {
      runReview: async (request) => {
        const orchestrator = await this.createOrchestrator({ copilotModelId: request.copilotModelId });
        return orchestrator.run(request);
      },
      publishEditedComment: async (request) => {
        const orchestrator = await this.createOrchestrator();
        return orchestrator.publishEditedComment(request);
      }
    });

    await this.webviewView?.webview.postMessage(outbound);
    this.outputChannel.appendLine(`[panel] outbound message posted: ${outbound.type}`);
    if (verboseLogs) {
      this.outputChannel.appendLine(`[panel] outbound payload: ${safeStringify(outbound)}`);
    }
  }

  private async createOrchestrator(options?: { copilotModelId?: string }): Promise<Stage1ReviewOrchestrator> {
    const configuration = vscode.workspace.getConfiguration(PR_REVIEWER_SETTINGS_SECTION);
    const structuredConfig = configuration.get("config");
    let configPatch: Stage1ConfigPatch = {};
    try {
      configPatch = await loadStage1ConfigPatchFromVsCodeSettings(PR_REVIEWER_SETTINGS_SECTION);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load VS Code settings.";
      void vscode.window.showWarningMessage(`PR Reviewer settings fallback to defaults: ${message}`);
      this.outputChannel.appendLine(`[config] fallback to defaults: ${message}`);
    }
    const useDemoData = readBooleanSetting(structuredConfig, "providers.useDemoData", true);
    const disableTlsValidation = readBooleanSetting(structuredConfig, "providers.disableTlsValidation", false);
    const providers = createPanelProviderSet({
      useDemoData,
      disableTlsValidation,
      configPatch
    });
    const llmMode = configPatch.llm?.mode ?? "copilot";
    const observabilityEnabled = configPatch.observability?.enabled ?? true;
    const verboseLogs = configPatch.observability?.verboseLogs ?? false;
    this.outputChannel.appendLine(
      `[config] useDemoData=${String(useDemoData)} disableTlsValidation=${String(disableTlsValidation)} llm.mode=${llmMode} observability.enabled=${String(observabilityEnabled)} observability.verboseLogs=${String(verboseLogs)}`
    );
    if (!observabilityEnabled) {
      this.outputChannel.appendLine("[pipeline] observability is disabled, progress events will not be emitted.");
    }
    if (verboseLogs) {
      this.outputChannel.appendLine(`[config] effective config patch: ${safeStringify(configPatch)}`);
    }
    const llmProvider =
      llmMode === "copilot" && options?.copilotModelId
        ? new CopilotLlmProvider({ preferredModelId: options.copilotModelId })
        : undefined;
    if (llmProvider) {
      this.outputChannel.appendLine(`[config] selected copilot model id=${options?.copilotModelId}`);
    }

    const reviewObserver = new PanelReviewObserver({
      log: (line) => this.outputChannel.appendLine(`[pipeline] ${line}`),
      onEvent: async (event, formatted) => {
        if (verboseLogs) {
          this.outputChannel.appendLine(`[pipeline:event] ${safeStringify(event)}`);
        }
        await this.postProgressEvent(event, formatted);
      }
    });

    return new Stage1ReviewOrchestrator({
      githubProvider: providers.githubProvider,
      jiraProvider: providers.jiraProvider,
      confluenceProvider: providers.confluenceProvider,
      llmProvider,
      config: configPatch,
      reviewObserver
    });
  }

  private async postCopilotModels(): Promise<void> {
    try {
      const models = await listCopilotChatModels();
      const outbound: PanelOutboundMessage = {
        type: "copilot-models",
        payload: {
          models: models.map((item) => ({
            id: item.id,
            label: item.label,
            ...(item.name ? { name: item.name } : {}),
            ...(item.family ? { family: item.family } : {}),
            ...(item.version ? { version: item.version } : {}),
            ...(item.reasoningEffort ? { reasoningEffort: item.reasoningEffort } : {})
          }))
        }
      };
      await this.webviewView?.webview.postMessage(outbound);
      this.outputChannel.appendLine(`[panel] outbound message posted: copilot-models (${models.length} models)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load Copilot models.";
      const outbound: PanelOutboundMessage = {
        type: "copilot-models",
        payload: {
          models: [],
          error: message
        }
      };
      await this.webviewView?.webview.postMessage(outbound);
      this.outputChannel.appendLine(`[panel] outbound message posted: copilot-models error=${message}`);
    }
  }

  private async postProgressEvent(event: ReviewEvent, text: string): Promise<void> {
    const payload: PanelOutboundMessage = {
      type: "review-progress",
      payload: {
        event,
        text
      }
    };
    await this.webviewView?.webview.postMessage(payload);
  }

  private isVerboseLogsEnabled(): boolean {
    const structuredConfig = vscode.workspace.getConfiguration(PR_REVIEWER_SETTINGS_SECTION).get("config");
    return readBooleanSetting(structuredConfig, "observability.verboseLogs", false);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function readBooleanSetting(root: unknown, path: string, defaultValue: boolean): boolean {
  const value = getNestedValue(root, path);
  return typeof value === "boolean" ? value : defaultValue;
}

function getNestedValue(root: unknown, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = root;
  for (const segment of segments) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isListCopilotModelsMessage(value: unknown): value is PanelInboundMessage & { type: "list-copilot-models" } {
  return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === "list-copilot-models");
}
