import type { Stage1Config } from "../config/types.js";
import type { ILlmProvider } from "../llm/llmProvider.js";
import type { IConfluenceProvider } from "../providers/confluenceProvider.js";
import type { IGithubProvider } from "../providers/githubProvider.js";
import type { IJiraProvider } from "../providers/jiraProvider.js";

export interface SkillContext {
  config: Stage1Config;
  providers: {
    github: IGithubProvider;
    jira: IJiraProvider;
    confluence: IConfluenceProvider;
  };
  llm?: ILlmProvider;
}
