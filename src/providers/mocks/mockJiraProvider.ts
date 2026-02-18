import type { JiraIssueContext } from "../../domain/types.js";
import type { IJiraProvider } from "../jiraProvider.js";

export class MockJiraProvider implements IJiraProvider {
  constructor(private readonly issues: JiraIssueContext[]) {}

  async getIssues(keys: string[]): Promise<JiraIssueContext[]> {
    const normalized = new Set(keys.map((key) => key.toUpperCase()));
    return this.issues.filter((issue) => normalized.has(issue.key.toUpperCase()));
  }
}
