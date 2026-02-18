import type { JiraContext } from "../domain/types.js";
import type { SkillContext } from "./context.js";
import type { Skill } from "./skill.js";

export interface FetchJiraContextInput {
  jiraKeys: string[];
}

export interface FetchJiraContextOutput {
  jira: JiraContext;
}

export class FetchJiraContextSkill
  implements Skill<FetchJiraContextInput, FetchJiraContextOutput, SkillContext>
{
  id = "fetch-jira-context";
  description = "Load Jira issues by extracted keys and normalize issue context.";

  async run(input: FetchJiraContextInput, context: SkillContext): Promise<FetchJiraContextOutput> {
    const requestedKeys = [...new Set(input.jiraKeys.map((key) => key.toUpperCase()))].sort();
    const issues = await context.providers.jira.getIssues(requestedKeys, {
      expandDepth: context.config.expandDepth
    });

    return {
      jira: {
        requestedKeys,
        issues: issues.sort((a, b) => a.key.localeCompare(b.key))
      }
    };
  }
}
