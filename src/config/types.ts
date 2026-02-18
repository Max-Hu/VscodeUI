import type { ScoreDimension } from "../domain/types.js";

export type CredentialMode = "none" | "pat" | "oauth" | "basic" | "vscodeAuth";

export interface ProviderCredentialConfig {
  mode: CredentialMode;
  tokenRef?: string;
  usernameRef?: string;
  passwordRef?: string;
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
