export class MockJiraProvider {
    issues;
    constructor(issues) {
        this.issues = issues;
    }
    async getIssues(keys) {
        const normalized = new Set(keys.map((key) => key.toUpperCase()));
        return this.issues.filter((issue) => normalized.has(issue.key.toUpperCase()));
    }
}
