import { extractJiraKeysFromCommits } from "../utils/extractJiraKeys.js";
export class ExtractJiraKeysSkill {
    id = "extract-jira-keys";
    description = "Extract Jira keys from commit messages with configurable regex.";
    async run(input, context) {
        const jiraPattern = new RegExp(context.config.jiraKeyPattern, "g");
        const jiraKeys = extractJiraKeysFromCommits(input.githubContext.commits, jiraPattern);
        if (!jiraKeys.length) {
            throw new Error("No Jira ID found in commit messages.");
        }
        return { jiraKeys };
    }
}
