import type { GithubContext } from "../domain/types.js";
import { extractJiraKeysFromCommits, extractJiraKeysFromText } from "../utils/extractJiraKeys.js";
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
  description = "Extract Jira keys from PR title, branches, comments, and commit messages with configurable regex.";

  async run(input: ExtractJiraKeysInput, context: SkillContext): Promise<ExtractJiraKeysOutput> {
    const createPattern = () => new RegExp(context.config.jiraKeyPattern, "gi");
    const titleKeys = extractJiraKeysFromText(input.githubContext.metadata.title, createPattern());
    const branchKeys = extractJiraKeysFromText(
      `${input.githubContext.metadata.baseBranch}\n${input.githubContext.metadata.headBranch}`,
      createPattern()
    );
    const commentKeys = input.githubContext.comments.flatMap((comment) =>
      extractJiraKeysFromText(comment.body, createPattern())
    );
    const commitKeys = extractJiraKeysFromCommits(input.githubContext.commits, createPattern());
    const jiraKeys = [...new Set([...titleKeys, ...branchKeys, ...commentKeys, ...commitKeys])].sort();
    if (!jiraKeys.length) {
      throw new Error("No Jira ID found in PR title, branches, comments, or commit messages.");
    }

    return { jiraKeys };
  }
}
