import type { ProviderConnectionConfig, ProviderCredentialConfig, Stage1Config, Stage1ConfigPatch } from "./types.js";

export function buildStage1ConfigPatchFromStructuredSettings(settings: unknown): Stage1ConfigPatch {
  const root = asRecord(settings);
  if (!root) {
    return {};
  }

  const patch: Stage1ConfigPatch = {};
  const providers = readProvidersSettings(root.providers);
  if (providers) {
    patch.providers = providers;
  }

  const llm = readLlmSettings(root.llm);
  if (llm) {
    patch.llm = llm;
  }

  const post = readPostSettings(root.post);
  if (post) {
    patch.post = post;
  }

  const resilience = readResilienceSettings(root.resilience);
  if (resilience) {
    patch.resilience = resilience;
  }

  const observability = readObservabilitySettings(root.observability);
  if (observability) {
    patch.observability = observability;
  }

  return patch;
}

export async function loadStage1ConfigPatchFromVsCodeSettings(section = "prReviewer"): Promise<Stage1ConfigPatch> {
  let vscodeModule: { workspace?: { getConfiguration?: (section?: string) => { get: (key: string) => unknown } } };
  try {
    const importVsCode = new Function("return import('vscode')") as () => Promise<{
      workspace?: { getConfiguration?: (section?: string) => { get: (key: string) => unknown } };
    }>;
    vscodeModule = await importVsCode();
  } catch {
    throw new Error("VS Code runtime is unavailable. loadStage1ConfigPatchFromVsCodeSettings must run in extension host.");
  }

  const configuration = vscodeModule.workspace?.getConfiguration?.(section);
  if (!configuration?.get) {
    throw new Error(`VS Code configuration section '${section}' is unavailable.`);
  }

  return buildStage1ConfigPatchFromStructuredSettings(configuration.get("config"));
}

function readProvidersSettings(value: unknown): Stage1ConfigPatch["providers"] | undefined {
  const providers = asRecord(value);
  if (!providers) {
    return undefined;
  }

  const result: Stage1ConfigPatch["providers"] = {};

  const github = readProviderConnection(providers.github, "github");
  if (github) {
    result.github = github;
  }

  const jira = readProviderConnection(providers.jira, "jira");
  if (jira) {
    result.jira = jira;
  }

  const confluence = readProviderConnection(providers.confluence, "confluence");
  if (confluence) {
    result.confluence = confluence;
  }

  return Object.keys(result).length ? result : undefined;
}

function readProviderConnection(
  value: unknown,
  provider: "github" | "jira" | "confluence"
): ProviderConnectionConfig | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  const connection = asRecord(value);
  if (!connection) {
    throw new Error(`prReviewer.config.providers.${provider} must be an object.`);
  }

  const domain = asNonEmptyString(connection.domain);
  if (domain) {
    assertSupportedProviderDomainShape(domain, provider);
  }
  const credential = readProviderCredential(connection.credential, provider);
  if (!domain && !credential) {
    return undefined;
  }

  return {
    domain: domain ?? "",
    credential: credential ?? {}
  };
}

function readProviderCredential(
  value: unknown,
  provider: "github" | "jira" | "confluence"
): ProviderCredentialConfig | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  const credential = asRecord(value);
  if (!credential) {
    throw new Error(`prReviewer.config.providers.${provider}.credential must be an object.`);
  }
  if ("mode" in credential) {
    throw new Error(
      `prReviewer.config.providers.${provider}.credential.mode is not supported. Use provider-specific credential fields only.`
    );
  }

  return readTokenCredential(credential, `prReviewer.config.providers.${provider}.credential`);
}

function readTokenCredential(value: Record<string, unknown>, path: string): ProviderCredentialConfig | undefined {
  if ("username" in value || "usernameRef" in value || "password" in value || "passwordRef" in value) {
    throw new Error(`${path} only supports token (or tokenRef).`);
  }

  const token = asNonEmptyString(value.token);
  const tokenRef = asNonEmptyString(value.tokenRef);
  if (!token && !tokenRef) {
    return undefined;
  }

  return {
    ...(token ? { token } : {}),
    ...(tokenRef ? { tokenRef } : {})
  };
}

function assertSupportedProviderDomainShape(
  domain: string,
  provider: "github" | "jira" | "confluence"
): void {
  let parsed: URL;
  try {
    parsed = new URL(domain);
  } catch {
    throw new Error(`prReviewer.config.providers.${provider}.domain must be a valid URL.`);
  }

  const path = parsed.pathname.replace(/\/+$/, "");
  if (provider === "github" && !/\/api\/v3$/i.test(path)) {
    throw new Error("prReviewer.config.providers.github.domain must match https://{host}/api/v3.");
  }
  if (provider === "jira" && !(/\/jira$/i.test(path) || /\/jira\/rest\/api\/2$/i.test(path))) {
    throw new Error("prReviewer.config.providers.jira.domain must match https://{host}/jira or .../jira/rest/api/2.");
  }
  if (provider === "confluence" && !(/\/confluence$/i.test(path) || /\/confluence\/rest\/api$/i.test(path))) {
    throw new Error(
      "prReviewer.config.providers.confluence.domain must match https://{host}/confluence or .../confluence/rest/api."
    );
  }
}

function readLlmSettings(value: unknown): Stage1ConfigPatch["llm"] | undefined {
  const llm = asRecord(value);
  if (!llm) {
    return undefined;
  }

  const useMock = asBoolean(llm.useMock);
  const mode = typeof useMock === "boolean" ? (useMock ? "mock" : "copilot") : asLlmMode(llm.mode);
  if (!mode) {
    return undefined;
  }

  return { mode };
}

function readPostSettings(value: unknown): Stage1ConfigPatch["post"] | undefined {
  const post = asRecord(value);
  if (!post) {
    return undefined;
  }

  const enabled = asBoolean(post.enabled);
  const requireConfirmation = asBoolean(post.requireConfirmation);
  if (typeof enabled !== "boolean" && typeof requireConfirmation !== "boolean") {
    return undefined;
  }

  return {
    ...(typeof enabled === "boolean" ? { enabled } : {}),
    ...(typeof requireConfirmation === "boolean" ? { requireConfirmation } : {})
  };
}

function readResilienceSettings(value: unknown): Stage1ConfigPatch["resilience"] | undefined {
  const resilience = asRecord(value);
  if (!resilience) {
    return undefined;
  }

  const continueOnConfluenceError = asBoolean(resilience.continueOnConfluenceError);
  if (typeof continueOnConfluenceError !== "boolean") {
    return undefined;
  }

  return { continueOnConfluenceError };
}

function readObservabilitySettings(value: unknown): Stage1ConfigPatch["observability"] | undefined {
  const observability = asRecord(value);
  if (!observability) {
    return undefined;
  }

  const enabled = asBoolean(observability.enabled);
  const verboseLogs = asBoolean(observability.verboseLogs);
  if (typeof enabled !== "boolean" && typeof verboseLogs !== "boolean") {
    return undefined;
  }

  return {
    ...(typeof enabled === "boolean" ? { enabled } : {}),
    ...(typeof verboseLogs === "boolean" ? { verboseLogs } : {})
  };
}

function asLlmMode(value: unknown): Stage1Config["llm"]["mode"] | undefined {
  if (value === "copilot" || value === "mock") {
    return value;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}
