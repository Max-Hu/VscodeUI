import type { GithubPullRequestPayload, PrReference } from "../../domain/types.js";
import type { IGithubProvider } from "../githubProvider.js";

function createKey(reference: PrReference): string {
  return `${reference.owner}/${reference.repo}#${reference.prNumber}`;
}

export class MockGithubProvider implements IGithubProvider {
  private readonly publishedComments: Array<{
    key: string;
    body: string;
    id: string;
    url: string;
  }> = [];

  constructor(private readonly dataset: Record<string, GithubPullRequestPayload>) {}

  async getPullRequest(reference: PrReference): Promise<GithubPullRequestPayload> {
    const key = createKey(reference);
    const data = this.dataset[key];
    if (!data) {
      throw new Error(`No mock pull request found for ${key}`);
    }
    return data;
  }

  async publishReviewComment(reference: PrReference, commentBody: string) {
    const key = createKey(reference);
    const id = `mock-comment-${this.publishedComments.length + 1}`;
    const url = `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.prNumber}#issuecomment-${this.publishedComments.length + 1}`;
    this.publishedComments.push({
      key,
      body: commentBody,
      id,
      url
    });
    return { id, url, body: commentBody };
  }

  getPublishedComments() {
    return [...this.publishedComments];
  }
}
