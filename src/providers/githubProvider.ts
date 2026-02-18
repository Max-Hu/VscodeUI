import type { GithubPullRequestPayload, PrReference } from "../domain/types.js";

export interface IGithubProvider {
  getPullRequest(reference: PrReference): Promise<GithubPullRequestPayload>;
}
