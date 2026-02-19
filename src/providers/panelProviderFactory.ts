import { defaultStage1Config } from "../config/defaults.js";
import type { DeepPartial, ProviderConnectionConfig, Stage1ConfigPatch } from "../config/types.js";
import type { IConfluenceProvider } from "./confluenceProvider.js";
import { DemoConfluenceProvider, DemoGithubProvider, DemoJiraProvider } from "./demo/demoProviders.js";
import type { IGithubProvider } from "./githubProvider.js";
import type { IJiraProvider } from "./jiraProvider.js";
import { ConfluenceRestProvider } from "./real/confluenceRestProvider.js";
import { GithubRestProvider } from "./real/githubRestProvider.js";
import { JiraRestProvider } from "./real/jiraRestProvider.js";

export interface PanelProviderSet {
  githubProvider: IGithubProvider;
  jiraProvider: IJiraProvider;
  confluenceProvider: IConfluenceProvider;
  source: "demo" | "real";
}

export function createPanelProviderSet(options: {
  useDemoData: boolean;
  disableTlsValidation?: boolean;
  configPatch: Stage1ConfigPatch;
}): PanelProviderSet {
  if (options.useDemoData) {
    return {
      githubProvider: new DemoGithubProvider(),
      jiraProvider: new DemoJiraProvider(),
      confluenceProvider: new DemoConfluenceProvider(),
      source: "demo"
    };
  }

  const githubConnection = mergeConnectionConfig(defaultStage1Config.providers.github, options.configPatch.providers?.github);
  const jiraConnection = mergeConnectionConfig(defaultStage1Config.providers.jira, options.configPatch.providers?.jira);
  const confluenceConnection = mergeConnectionConfig(
    defaultStage1Config.providers.confluence,
    options.configPatch.providers?.confluence
  );

  return {
    githubProvider: new GithubRestProvider(githubConnection, {
      disableTlsValidation: options.disableTlsValidation
    }),
    jiraProvider: new JiraRestProvider(jiraConnection, {
      disableTlsValidation: options.disableTlsValidation
    }),
    confluenceProvider: new ConfluenceRestProvider(confluenceConnection, {
      disableTlsValidation: options.disableTlsValidation
    }),
    source: "real"
  };
}

function mergeConnectionConfig(
  base: ProviderConnectionConfig,
  patch: DeepPartial<ProviderConnectionConfig> | undefined
): ProviderConnectionConfig {
  return {
    domain: patch?.domain ?? base.domain,
    credential: {
      ...base.credential,
      ...(patch?.credential ?? {})
    }
  };
}
