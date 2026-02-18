export class FetchJiraContextSkill {
    id = "fetch-jira-context";
    description = "Load Jira issues by extracted keys and normalize issue context.";
    async run(input, context) {
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
