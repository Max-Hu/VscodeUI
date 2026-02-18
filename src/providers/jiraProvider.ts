import type { JiraIssueContext } from "../domain/types.js";

export interface IJiraProvider {
  getIssues(keys: string[], options: { expandDepth: number }): Promise<JiraIssueContext[]>;
}
