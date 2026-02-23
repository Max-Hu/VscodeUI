import type { ILlmProvider } from "./llmProvider.js";

export interface CopilotModelCatalogItem {
  id: string;
  name: string;
  family: string;
  version: string;
  label: string;
  reasoningEffort?: string;
}

interface CopilotLlmProviderOptions {
  preferredModelId?: string;
}

export class CopilotLlmProvider implements ILlmProvider {
  private lastModelLabel = "auto";
  constructor(private readonly options: CopilotLlmProviderOptions = {}) {}

  describe(): string {
    return `provider=copilot | model=${this.lastModelLabel}`;
  }

  async generate(prompt: string): Promise<string> {
    const vscode = await loadVsCode();
    const lm = vscode?.lm;
    if (!lm?.selectChatModels) {
      throw new Error("VS Code LM API is unavailable.");
    }

    const models = await lm.selectChatModels({ vendor: "copilot" });
    if (!Array.isArray(models) || models.length === 0) {
      throw new Error(
        "No Copilot chat model is available. Ensure GitHub Copilot is installed and signed in, and use the non-isolated debug launch profile."
      );
    }

    const catalog = models.map((candidate, index) => toCopilotModelCatalogItem(candidate, index));
    console.log(
      `[Copilot] available models total=${catalog.length} labels=${catalog
        .map((item, index) => `#${index} ${item.label}${item.reasoningEffort ? ` [effort=${item.reasoningEffort}]` : ""}`)
        .join(", ")}`
    );

    const model = selectModel(models, this.options.preferredModelId);
    this.lastModelLabel = toModelLabel(model);
    console.log(`[Copilot] selected model=${this.lastModelLabel}`);
    const message = vscode.LanguageModelChatMessage?.User
      ? vscode.LanguageModelChatMessage.User(prompt)
      : { role: "user", content: prompt };

    const request = await (model as { sendRequest: (messages: unknown[], options?: unknown) => Promise<unknown> }).sendRequest(
      [message],
      {}
    );
    const response = request as { text?: unknown } | undefined;
    return await readLmText(response?.text);
  }
}

export async function listCopilotChatModels(): Promise<CopilotModelCatalogItem[]> {
  const vscode = await loadVsCode();
  const lm = vscode?.lm;
  if (!lm?.selectChatModels) {
    throw new Error("VS Code LM API is unavailable.");
  }
  const models = await lm.selectChatModels({ vendor: "copilot" });
  if (!Array.isArray(models)) {
    return [];
  }
  return models.map((model, index) => toCopilotModelCatalogItem(model, index));
}

async function loadVsCode(): Promise<any> {
  try {
    const importVsCode = new Function("return import('vscode')") as () => Promise<any>;
    return await importVsCode();
  } catch {
    throw new Error("VS Code runtime is unavailable. Copilot provider must run in extension host.");
  }
}

async function readLmText(stream: unknown): Promise<string> {
  if (!stream) {
    throw new Error("Copilot response stream is empty.");
  }
  if (typeof stream === "string") {
    return stream;
  }
  if (isAsyncIterable(stream)) {
    let output = "";
    for await (const part of stream) {
      output += stringifyLmPart(part);
    }
    if (!output.trim()) {
      throw new Error("Copilot returned empty text.");
    }
    return output;
  }
  return stringifyLmPart(stream);
}

function stringifyLmPart(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }
  if (part && typeof part === "object" && "value" in part && typeof (part as { value: unknown }).value === "string") {
    return (part as { value: string }).value;
  }
  return String(part ?? "");
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return Boolean(value && typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function");
}

function toModelLabel(model: unknown): string {
  if (!model || typeof model !== "object") {
    return "auto";
  }
  const candidate = model as Record<string, unknown>;
  const id = asNonEmptyString(candidate.id);
  const name = asNonEmptyString(candidate.name);
  const family = asNonEmptyString(candidate.family);
  return id ?? name ?? family ?? "auto";
}

function selectModel(models: unknown[], preferredModelId?: string): unknown {
  const preferred = preferredModelId?.trim();
  if (!preferred) {
    return models[0];
  }
  const match = models.find((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }
    return asNonEmptyString((candidate as Record<string, unknown>).id) === preferred;
  });
  if (!match) {
    throw new Error(`Selected Copilot model is unavailable: ${preferred}`);
  }
  return match;
}

function toCopilotModelCatalogItem(model: unknown, index: number): CopilotModelCatalogItem {
  const candidate = model && typeof model === "object" ? (model as Record<string, unknown>) : {};
  const id = asNonEmptyString(candidate.id) ?? `unknown-${index}`;
  const name = asNonEmptyString(candidate.name) ?? "";
  const family = asNonEmptyString(candidate.family) ?? "";
  const version = asNonEmptyString(candidate.version) ?? "";
  const reasoningEffort = inferReasoningEffort(candidate);
  const labelParts = [
    toModelLabel(candidate),
    version ? `v=${version}` : "",
    reasoningEffort ? `effort=${reasoningEffort}` : ""
  ].filter(Boolean);
  return {
    id,
    name,
    family,
    version,
    label: labelParts.join(" | "),
    ...(reasoningEffort ? { reasoningEffort } : {})
  };
}

function inferReasoningEffort(candidate: Record<string, unknown>): string | undefined {
  const directCandidates = [
    candidate.reasoningEffort,
    candidate.computeMultiplier,
    candidate.effort,
    candidate.detail,
    candidate.tooltip
  ];
  for (const value of directCandidates) {
    const extracted = extractEffortTag(value);
    if (extracted) {
      return extracted;
    }
  }

  for (const [key, value] of Object.entries(candidate)) {
    if (!/reason|effort|compute|multiplier/i.test(key)) {
      continue;
    }
    const extracted = extractEffortTag(value);
    if (extracted) {
      return extracted;
    }
  }

  return undefined;
}

function extractEffortTag(value: unknown): string | undefined {
  if (typeof value === "string") {
    const match = value.match(/\b(\d+(?:\.\d+)?x)\b/i);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
    return undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}x`;
  }
  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      const nested = extractEffortTag(nestedValue);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}
