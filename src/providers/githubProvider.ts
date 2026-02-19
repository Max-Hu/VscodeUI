import type { GithubPullRequestPayload, PrReference, PublishedComment } from "../domain/types.js";

export interface IGithubProvider {
  getPullRequest(reference: PrReference): Promise<GithubPullRequestPayload>;
  publishReviewComment(reference: PrReference, commentBody: string): Promise<PublishedComment>;
}
