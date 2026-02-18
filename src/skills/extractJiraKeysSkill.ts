import type { GithubContext } from "../domain/types.js";
import { extractJiraKeysFromCommits } from "../utils/extractJiraKeys.js";
import type { SkillContext } from "./context.js";
import type { Skill } from "./skill.js";

export interface ExtractJiraKeysInput {
  githubContext: GithubContext;
}

export interface ExtractJiraKeysOutput {
  jiraKeys: string[];
}

export class ExtractJiraKeysSkill
  implements Skill<ExtractJiraKeysInput, ExtractJiraKeysOutput, SkillContext>
{
  id = "extract-jira-keys";
  description = "Extract Jira keys from commit messages with configurable regex.";

  async run(input: ExtractJiraKeysInput, context: SkillContext): Promise<ExtractJiraKeysOutput> {
    const jiraPattern = new RegExp(context.config.jiraKeyPattern, "g");
    const jiraKeys = extractJiraKeysFromCommits(input.githubContext.commits, jiraPattern);
    if (!jiraKeys.length) {
      throw new Error("No Jira ID found in commit messages.");
    }

    return { jiraKeys };
  }
}
