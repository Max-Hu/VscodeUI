import type { GithubPullRequestPayload, PrReference } from "../../domain/types.js";
import type { IGithubProvider } from "../githubProvider.js";

function createKey(reference: PrReference): string {
  return `${reference.owner}/${reference.repo}#${reference.prNumber}`;
}

export class MockGithubProvider implements IGithubProvider {
  constructor(private readonly dataset: Record<string, GithubPullRequestPayload>) {}

  async getPullRequest(reference: PrReference): Promise<GithubPullRequestPayload> {
    const key = createKey(reference);
    const data = this.dataset[key];
    if (!data) {
      throw new Error(`No mock pull request found for ${key}`);
    }
    return data;
  }
}
