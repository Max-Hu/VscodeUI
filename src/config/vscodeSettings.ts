import type { CredentialMode, ProviderConnectionConfig, Stage1Config, Stage1ConfigPatch } from "./types.js";

type FlatSettings = Record<string, unknown>;

const CREDENTIAL_MODES: CredentialMode[] = ["none", "pat", "oauth", "basic", "vscodeAuth"];

export function buildStage1ConfigPatchFromFlatSettings(settings: FlatSettings): Stage1ConfigPatch {
  const github = readProviderSettings(settings, "github");
  const jira = readProviderSettings(settings, "jira");
  const confluence = readProviderSettings(settings, "confluence");

  const providers: Stage1ConfigPatch["providers"] = {};
  if (github) {
    providers.github = github;
  }
  if (jira) {
    providers.jira = jira;
  }
  if (confluence) {
    providers.confluence = confluence;
  }

  const patch: Stage1ConfigPatch = {};
  if (Object.keys(providers).length) {
    patch.providers = providers;
  }

  const llmMode = asLlmMode(settings["llm.mode"]);
  if (llmMode) {
    patch.llm = {
      mode: llmMode
    };
  }

  const postEnabled = asBoolean(settings["post.enabled"]);
  const postRequireConfirmation = asBoolean(settings["post.requireConfirmation"]);
  if (typeof postEnabled === "boolean" || typeof postRequireConfirmation === "boolean") {
    patch.post = {
      ...(typeof postEnabled === "boolean" ? { enabled: postEnabled } : {}),
      ...(typeof postRequireConfirmation === "boolean" ? { requireConfirmation: postRequireConfirmation } : {})
    };
  }

  const continueOnConfluenceError = asBoolean(settings["resilience.continueOnConfluenceError"]);
  if (typeof continueOnConfluenceError === "boolean") {
    patch.resilience = {
      continueOnConfluenceError
    };
  }

  const observabilityEnabled = asBoolean(settings["observability.enabled"]);
  if (typeof observabilityEnabled === "boolean") {
    patch.observability = {
      enabled: observabilityEnabled
    };
  }

  return patch;
}

export async function loadStage1ConfigPatchFromVsCodeSettings(
  section = "prReviewer"
): Promise<Stage1ConfigPatch> {
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

  return buildStage1ConfigPatchFromFlatSettings({
    "providers.github.domain": configuration.get("providers.github.domain"),
    "providers.github.credential.mode": configuration.get("providers.github.credential.mode"),
    "providers.github.credential.tokenRef": configuration.get("providers.github.credential.tokenRef"),
    "providers.github.credential.usernameRef": configuration.get("providers.github.credential.usernameRef"),
    "providers.github.credential.passwordRef": configuration.get("providers.github.credential.passwordRef"),
    "providers.github.credential.token": configuration.get("providers.github.credential.token"),
    "providers.github.credential.username": configuration.get("providers.github.credential.username"),
    "providers.github.credential.password": configuration.get("providers.github.credential.password"),
    "providers.jira.domain": configuration.get("providers.jira.domain"),
    "providers.jira.credential.mode": configuration.get("providers.jira.credential.mode"),
    "providers.jira.credential.tokenRef": configuration.get("providers.jira.credential.tokenRef"),
    "providers.jira.credential.usernameRef": configuration.get("providers.jira.credential.usernameRef"),
    "providers.jira.credential.passwordRef": configuration.get("providers.jira.credential.passwordRef"),
    "providers.jira.credential.token": configuration.get("providers.jira.credential.token"),
    "providers.jira.credential.username": configuration.get("providers.jira.credential.username"),
    "providers.jira.credential.password": configuration.get("providers.jira.credential.password"),
    "providers.confluence.domain": configuration.get("providers.confluence.domain"),
    "providers.confluence.credential.mode": configuration.get("providers.confluence.credential.mode"),
    "providers.confluence.credential.tokenRef": configuration.get("providers.confluence.credential.tokenRef"),
    "providers.confluence.credential.usernameRef": configuration.get("providers.confluence.credential.usernameRef"),
    "providers.confluence.credential.passwordRef": configuration.get("providers.confluence.credential.passwordRef"),
    "providers.confluence.credential.token": configuration.get("providers.confluence.credential.token"),
    "providers.confluence.credential.username": configuration.get("providers.confluence.credential.username"),
    "providers.confluence.credential.password": configuration.get("providers.confluence.credential.password"),
    "llm.mode": configuration.get("llm.mode"),
    "post.enabled": configuration.get("post.enabled"),
    "post.requireConfirmation": configuration.get("post.requireConfirmation"),
    "resilience.continueOnConfluenceError": configuration.get("resilience.continueOnConfluenceError"),
    "observability.enabled": configuration.get("observability.enabled")
  });
}

function readProviderSettings(
  settings: FlatSettings,
  provider: "github" | "jira" | "confluence"
): ProviderConnectionConfig | undefined {
  const base = `providers.${provider}`;
  const domain = asNonEmptyString(settings[`${base}.domain`]);
  const mode = asCredentialMode(settings[`${base}.credential.mode`]);
  const tokenRef = asNonEmptyString(settings[`${base}.credential.tokenRef`]);
  const usernameRef = asNonEmptyString(settings[`${base}.credential.usernameRef`]);
  const passwordRef = asNonEmptyString(settings[`${base}.credential.passwordRef`]);
  const token = asNonEmptyString(settings[`${base}.credential.token`]);
  const username = asNonEmptyString(settings[`${base}.credential.username`]);
  const password = asNonEmptyString(settings[`${base}.credential.password`]);

  const hasCredentialValue = Boolean(mode || tokenRef || usernameRef || passwordRef || token || username || password);
  const hasDomain = Boolean(domain);
  if (!hasDomain && !hasCredentialValue) {
    return undefined;
  }

  return {
    domain: domain ?? "",
    credential: {
      mode: mode ?? "none",
      ...(tokenRef ? { tokenRef } : {}),
      ...(usernameRef ? { usernameRef } : {}),
      ...(passwordRef ? { passwordRef } : {}),
      ...(token ? { token } : {}),
      ...(username ? { username } : {}),
      ...(password ? { password } : {})
    }
  };
}

function asCredentialMode(value: unknown): CredentialMode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return CREDENTIAL_MODES.includes(value as CredentialMode) ? (value as CredentialMode) : undefined;
}

function asLlmMode(value: unknown): Stage1Config["llm"]["mode"] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  if (value === "copilot" || value === "mock") {
    return value;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
