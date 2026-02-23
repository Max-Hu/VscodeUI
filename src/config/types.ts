import type { ScoreDimension } from "../domain/types.js";

export interface ProviderCredentialConfig {
  tokenRef?: string;
  token?: string;
}

export interface ProviderConnectionConfig {
  domain: string;
  credential: ProviderCredentialConfig;
}

export interface Stage1Config {
  expandDepth: number;
  topK: number;
  maxFiles: number;
  maxPatchCharsPerFile: number;
  jiraKeyPattern: string;
  providers: {
    github: ProviderConnectionConfig;
    jira: ProviderConnectionConfig;
    confluence: ProviderConnectionConfig;
  };
  llm: {
    mode: "copilot" | "mock";
  };
  post: {
    enabled: boolean;
    requireConfirmation: boolean;
  };
  resilience: {
    continueOnConfluenceError: boolean;
  };
  observability: {
    enabled: boolean;
    verboseLogs: boolean;
  };
  scoring: {
    weights: Record<ScoreDimension, number>;
  };
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type Stage1ConfigPatch = DeepPartial<Stage1Config>;
