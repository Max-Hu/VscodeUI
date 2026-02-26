import * as vscode from "vscode";
import type { PrReference } from "../domain/types.js";
import { loadStage1ConfigPatchFromVsCodeSettings } from "../config/vscodeSettings.js";
import type { Stage1ConfigPatch } from "../config/types.js";
import { CopilotLlmProvider, listCopilotChatModels } from "../llm/copilotLlmProvider.js";
import { PanelReviewObserver } from "../observability/panelReviewObserver.js";
import type { ReviewEvent } from "../observability/reviewObserver.js";
import { Stage1ReviewOrchestrator } from "../orchestrator/reviewOrchestrator.js";
import { createPanelProviderSet } from "../providers/panelProviderFactory.js";
import type { GithubPrDiffFile } from "../providers/real/githubRestProvider.js";
import type { IGithubProvider } from "../providers/githubProvider.js";
import { parsePrLink } from "../utils/parsePrLink.js";
import type { PanelInboundMessage, PanelOutboundMessage } from "../views/panelContracts.js";
import { getNonce, getPanelHtml } from "./panelHtml.js";
import type { PrDiffTreeFileItem, PrDiffTreeProvider } from "./prDiffTreeProvider.js";
import { routePanelMessage } from "./panelMessageRouter.js";

export const PR_REVIEWER_VIEW_ID = "prReviewer.panel";
export const PR_REVIEWER_SETTINGS_SECTION = "prReviewer";
export const PR_REVIEWER_DIFF_SCHEME = "pr-reviewer-diff";

export class PrReviewerPanelProvider implements vscode.WebviewViewProvider, vscode.TextDocumentContentProvider {
  private webviewView: vscode.WebviewView | undefined;
  private readonly diffDocuments = new Map<string, string>();
  private readonly prDiffSnapshots = new Map<string, CachedPrDiffSnapshot>();

  constructor(
    private readonly outputChannel: vscode.OutputChannel,
    private readonly prDiffTreeProvider?: PrDiffTreeProvider
  ) {}

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

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.diffDocuments.get(uri.toString()) ?? "";
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
    if (isLoadPrDiffFilesMessage(message)) {
      await this.handleLoadPrDiffFiles(message);
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

  private async handleLoadPrDiffFiles(
    message: Extract<PanelInboundMessage, { type: "load-pr-diff-files" }>
  ): Promise<void> {
    const prLink = asNonEmptyString(message.payload?.prLink);
    if (!prLink) {
      await this.postPrDiffFailed("PR link is required.");
      return;
    }

    try {
      const cached = await this.loadPrDiffSnapshot(prLink);
      const files = cached.snapshot.files.map(toPrDiffFileListItem);
      const selectableFiles = files.filter((file) => file.openable).length;
      const unsupportedFiles = Math.max(0, files.length - selectableFiles);
      this.prDiffTreeProvider?.setModel({
        prLink: cached.prLink,
        prTitle: cached.snapshot.prTitle,
        source: cached.source,
        files
      });

      await this.postPanelMessage({
        type: "pr-diff-files-loaded",
        payload: {
          prLink: cached.prLink,
          prTitle: cached.snapshot.prTitle,
          source: cached.source,
          totalFiles: files.length,
          selectableFiles,
          unsupportedFiles
        }
      });
    } catch (error) {
      await this.postPrDiffFailed(error instanceof Error ? error.message : "Failed to load PR diff files.");
    }
  }

  async openPrDiffFileFromTree(prLink: string, filePath: string): Promise<void> {
    await this.openPrDiffFiles({
      prLink,
      filePaths: [filePath]
    });
  }

  async openAllPrDiffFilesFromTree(prLink: string): Promise<void> {
    await this.openPrDiffFiles({
      prLink,
      openAll: true
    });
  }

  private async openPrDiffFiles(options: { prLink: string; filePaths?: string[]; openAll?: boolean }): Promise<void> {
    const prLink = asNonEmptyString(options.prLink);
    if (!prLink) {
      await this.postPrDiffFailed("PR link is required.");
      return;
    }

    try {
      const { githubProvider } = await this.createGithubProviderForPrDiff();
      if (!isPrDiffCapableGithubProvider(githubProvider)) {
        throw new Error("Current GitHub provider does not support PR diff preview.");
      }

      const cached = await this.getOrLoadPrDiffSnapshot(prLink);
      const allOpenableFiles = cached.snapshot.files.filter(isTextDiffCandidate);
      if (!allOpenableFiles.length) {
        throw new Error("No text diff files available to open for this PR.");
      }

      const openAll = Boolean(options.openAll);
      const requestedPaths = uniqueNonEmptyStrings(options.filePaths);
      const openableByPath = new Map(allOpenableFiles.map((file) => [file.path, file]));
      const filesToOpen = openAll
        ? allOpenableFiles
        : requestedPaths.map((path) => openableByPath.get(path)).filter(isDefined);

      if (!openAll && requestedPaths.length === 0) {
        throw new Error("Select at least one PR file to open diff.");
      }
      if (filesToOpen.length === 0) {
        throw new Error("Selected files are not available for text diff preview.");
      }

      let openedFiles = 0;
      let skippedFiles = 0;
      const requestedFiles = openAll ? allOpenableFiles.length : requestedPaths.length;
      if (openAll) {
        skippedFiles += Math.max(0, cached.snapshot.files.length - allOpenableFiles.length);
      } else {
        skippedFiles += Math.max(0, requestedPaths.length - filesToOpen.length);
      }

      for (const file of filesToOpen) {
        const opened = await this.openSinglePrFileDiff({
          reference: cached.reference,
          file,
          baseSha: cached.snapshot.baseSha,
          headSha: cached.snapshot.headSha,
          githubProvider
        });
        if (opened) {
          openedFiles += 1;
        } else {
          skippedFiles += 1;
        }
      }

      await this.postPanelMessage({
        type: "pr-diff-opened",
        payload: {
          totalFiles: cached.snapshot.files.length,
          requestedFiles,
          openedFiles,
          skippedFiles
        }
      });
    } catch (error) {
      await this.postPrDiffFailed(error instanceof Error ? error.message : "Failed to open PR diff.");
      throw error;
    }
  }

  private async getOrLoadPrDiffSnapshot(prLink: string): Promise<CachedPrDiffSnapshot> {
    const normalizedPrLink = normalizePrLinkCacheKey(prLink);
    const cached = this.prDiffSnapshots.get(normalizedPrLink);
    if (cached) {
      const { source } = await this.createGithubProviderForPrDiff();
      if (cached.source === source) {
        return cached;
      }
    }
    return this.loadPrDiffSnapshot(prLink);
  }

  private async loadPrDiffSnapshot(prLink: string): Promise<CachedPrDiffSnapshot> {
    const reference = parsePrLink(prLink);
    const { githubProvider, source } = await this.createGithubProviderForPrDiff();
    if (!isPrDiffCapableGithubProvider(githubProvider)) {
      throw new Error("Current GitHub provider does not support PR diff preview.");
    }
    const snapshot = await githubProvider.getPullRequestDiffSnapshot(reference);
    const cached: CachedPrDiffSnapshot = {
      prLink: prLink.trim(),
      reference,
      source,
      snapshot
    };
    this.prDiffSnapshots.set(normalizePrLinkCacheKey(prLink), cached);
    trimMap(this.prDiffSnapshots, 20);
    return cached;
  }

  private async openSinglePrFileDiff(options: {
    reference: PrReference;
    file: GithubPrDiffFile;
    baseSha: string;
    headSha: string;
    githubProvider: PrDiffCapableGithubProvider;
  }): Promise<boolean> {
    const { file, reference, baseSha, headSha, githubProvider } = options;
    const basePath = file.status === "renamed" ? file.previousPath ?? file.path : file.path;
    const headPath = file.path;
    const baseMissingExpected = file.status === "added";
    const headMissingExpected = file.status === "removed";

    const baseContent = baseMissingExpected ? "" : await githubProvider.getTextFileContentAtRef(reference, basePath, baseSha);
    const headContent = headMissingExpected ? "" : await githubProvider.getTextFileContentAtRef(reference, headPath, headSha);

    if ((!baseMissingExpected && typeof baseContent !== "string") || (!headMissingExpected && typeof headContent !== "string")) {
      this.outputChannel.appendLine(`[pr-diff] skipped unsupported file: ${file.path} status=${file.status}`);
      return false;
    }
    const resolvedBaseContent = typeof baseContent === "string" ? baseContent : "";
    const resolvedHeadContent = typeof headContent === "string" ? headContent : "";

    const leftUri = this.createPrDiffDocumentUri({
      reference,
      filePath: basePath,
      side: "base",
      sha: baseSha,
      content: resolvedBaseContent
    });
    const rightUri = this.createPrDiffDocumentUri({
      reference,
      filePath: headPath,
      side: "head",
      sha: headSha,
      content: resolvedHeadContent
    });

    const title = buildPrDiffTitle(reference, file);
    await vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, title);
    this.outputChannel.appendLine(`[pr-diff] opened diff: ${title}`);
    return true;
  }

  private createPrDiffDocumentUri(options: {
    reference: PrReference;
    filePath: string;
    side: "base" | "head";
    sha: string;
    content: string;
  }): vscode.Uri {
    const normalizedFilePath = normalizeVirtualPath(options.filePath);
    const uniqueId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const uri = vscode.Uri.from({
      scheme: PR_REVIEWER_DIFF_SCHEME,
      path: `/${options.reference.owner}/${options.reference.repo}/pr-${options.reference.prNumber}/${options.side}/${uniqueId}${normalizedFilePath}`,
      query: `sha=${options.sha.slice(0, 12)}`
    });
    this.diffDocuments.set(uri.toString(), options.content);
    trimMap(this.diffDocuments, 400);
    return uri;
  }

  private async createGithubProviderForPrDiff(): Promise<{
    githubProvider: ReturnType<typeof createPanelProviderSet>["githubProvider"];
    source: ReturnType<typeof createPanelProviderSet>["source"];
  }> {
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

    return {
      githubProvider: providers.githubProvider,
      source: providers.source
    };
  }

  private async postPrDiffFailed(message: string): Promise<void> {
    await this.postPanelMessage({
      type: "pr-diff-failed",
      payload: {
        message
      }
    });
  }

  private async postPanelMessage(message: PanelOutboundMessage): Promise<void> {
    await this.webviewView?.webview.postMessage(message);
    this.outputChannel.appendLine(`[panel] outbound message posted: ${message.type}`);
    if (this.isVerboseLogsEnabled()) {
      this.outputChannel.appendLine(`[panel] outbound payload: ${safeStringify(message)}`);
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
    const selectedPanelModelId = options?.copilotModelId?.trim();
    const panelSelectedMock = selectedPanelModelId === "mock";
    const panelSelectedCopilot = Boolean(selectedPanelModelId && !panelSelectedMock);
    if (panelSelectedMock) {
      configPatch = {
        ...configPatch,
        llm: {
          ...(configPatch.llm ?? {}),
          mode: "mock"
        }
      };
    } else if (panelSelectedCopilot) {
      configPatch = {
        ...configPatch,
        llm: {
          ...(configPatch.llm ?? {}),
          mode: "copilot"
        }
      };
    }
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
      panelSelectedCopilot
        ? new CopilotLlmProvider({ preferredModelId: selectedPanelModelId })
        : undefined;
    if (panelSelectedMock) {
      this.outputChannel.appendLine("[config] panel model selection=mock (overrides VS Code LLM mode for this review)");
    } else if (llmProvider) {
      this.outputChannel.appendLine(`[config] selected copilot model id=${selectedPanelModelId}`);
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

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function isListCopilotModelsMessage(value: unknown): value is PanelInboundMessage & { type: "list-copilot-models" } {
  return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === "list-copilot-models");
}

function isLoadPrDiffFilesMessage(value: unknown): value is Extract<PanelInboundMessage, { type: "load-pr-diff-files" }> {
  return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === "load-pr-diff-files");
}

interface PrDiffCapableGithubProvider extends IGithubProvider {
  getPullRequestDiffSnapshot(reference: PrReference): Promise<{
    prTitle: string;
    baseSha: string;
    headSha: string;
    files: GithubPrDiffFile[];
  }>;
  getTextFileContentAtRef(reference: PrReference, path: string, ref: string): Promise<string | undefined>;
}

interface CachedPrDiffSnapshot {
  prLink: string;
  reference: PrReference;
  source: "demo" | "real";
  snapshot: {
    prTitle: string;
    baseSha: string;
    headSha: string;
    files: GithubPrDiffFile[];
  };
}

function isPrDiffCapableGithubProvider(value: IGithubProvider): value is PrDiffCapableGithubProvider {
  const candidate = value as Partial<PrDiffCapableGithubProvider>;
  return (
    typeof candidate.getPullRequestDiffSnapshot === "function" &&
    typeof candidate.getTextFileContentAtRef === "function"
  );
}

function toPrDiffFileListItem(file: GithubPrDiffFile): PrDiffTreeFileItem {
  const openable = isTextDiffCandidate(file);
  return {
    path: file.path,
    status: file.status,
    ...(file.previousPath ? { previousPath: file.previousPath } : {}),
    openable,
    ...(openable ? {} : { reason: "Binary or unsupported file type" })
  };
}

function isTextDiffCandidate(file: GithubPrDiffFile): boolean {
  const path = (file.path || "").toLowerCase();
  if (!path) {
    return false;
  }
  const binaryExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".webp",
    ".ico",
    ".pdf",
    ".zip",
    ".gz",
    ".tar",
    ".jar",
    ".war",
    ".mp3",
    ".mp4",
    ".mov",
    ".avi",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".class",
    ".exe",
    ".dll"
  ];
  return !binaryExtensions.some((ext) => path.endsWith(ext));
}

function buildPrDiffTitle(reference: PrReference, file: GithubPrDiffFile): string {
  const status = file.status.toUpperCase();
  if (file.status === "renamed" && file.previousPath) {
    return `${reference.owner}/${reference.repo}#${reference.prNumber} [${status}] ${file.previousPath} -> ${file.path}`;
  }
  return `${reference.owner}/${reference.repo}#${reference.prNumber} [${status}] ${file.path}`;
}

function normalizeVirtualPath(path: string): string {
  const normalized = path
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
  return normalized ? `/${normalized}` : "/file.txt";
}

function trimMap<K, V>(map: Map<K, V>, maxSize: number): void {
  while (map.size > maxSize) {
    const firstKey = map.keys().next().value;
    if (typeof firstKey === "undefined") {
      return;
    }
    map.delete(firstKey);
  }
}

function normalizePrLinkCacheKey(prLink: string): string {
  return prLink.trim();
}

function uniqueNonEmptyStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function isDefined<T>(value: T | undefined): value is T {
  return typeof value !== "undefined";
}
