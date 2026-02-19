import type { ProviderConnectionConfig } from "../../config/types.js";
import type { GithubPullRequestPayload, PrReference, PublishedComment, PullRequestCheck } from "../../domain/types.js";
import type { IGithubProvider } from "../githubProvider.js";
import { HttpJsonClient } from "./httpJsonClient.js";

const GITHUB_ACCEPT = "application/vnd.github+json";

export class GithubRestProvider implements IGithubProvider {
  private readonly client: HttpJsonClient;

  constructor(connection: ProviderConnectionConfig, options?: { disableTlsValidation?: boolean }) {
    this.client = new HttpJsonClient({
      providerName: "GitHub",
      baseUrl: connection.domain,
      credential: connection.credential,
      disableTlsValidation: options?.disableTlsValidation,
      defaultHeaders: {
        Accept: GITHUB_ACCEPT,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
  }

  async getPullRequest(reference: PrReference): Promise<GithubPullRequestPayload> {
    const basePath = `/repos/${reference.owner}/${reference.repo}`;
    const pull = await this.client.requestJson<any>(`${basePath}/pulls/${reference.prNumber}`);
    const files = await this.fetchPagedArray<any>(`${basePath}/pulls/${reference.prNumber}/files`);
    const commits = await this.fetchPagedArray<any>(`${basePath}/pulls/${reference.prNumber}/commits`);
    const comments = await this.fetchPagedArray<any>(`${basePath}/issues/${reference.prNumber}/comments`);

    let checks: PullRequestCheck[] = [];
    const headSha = asString(pull?.head?.sha);
    if (headSha) {
      try {
        const checkResponse = await this.client.requestJson<any>(`${basePath}/commits/${headSha}/check-runs`, {
          query: {
            per_page: 100
          }
        });
        const checkRuns = Array.isArray(checkResponse?.check_runs) ? checkResponse.check_runs : [];
        checks = checkRuns.map(mapCheckRun);
      } catch {
        checks = [];
      }
    }

    return {
      metadata: {
        title: asString(pull?.title, `PR #${reference.prNumber}`),
        body: asString(pull?.body),
        author: asString(pull?.user?.login, "unknown"),
        baseBranch: asString(pull?.base?.ref, "unknown"),
        headBranch: asString(pull?.head?.ref, "unknown"),
        url: asString(
          pull?.html_url,
          `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.prNumber}`
        )
      },
      files: files.map((file) => ({
        path: asString(file?.filename, "unknown"),
        patch: asString(file?.patch)
      })),
      commits: commits.map((commit) => ({
        sha: asString(commit?.sha),
        message: asString(commit?.commit?.message)
      })),
      checks,
      comments: comments.map((comment) => ({
        author: asString(comment?.user?.login, "unknown"),
        body: asString(comment?.body)
      }))
    };
  }

  async publishReviewComment(reference: PrReference, commentBody: string): Promise<PublishedComment> {
    const basePath = `/repos/${reference.owner}/${reference.repo}`;
    const response = await this.client.requestJson<any>(`${basePath}/issues/${reference.prNumber}/comments`, {
      method: "POST",
      body: {
        body: commentBody
      }
    });

    return {
      id: String(response?.id ?? ""),
      url: asString(
        response?.html_url,
        `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.prNumber}`
      ),
      body: asString(response?.body, commentBody)
    };
  }

  private async fetchPagedArray<T>(path: string): Promise<T[]> {
    const result: T[] = [];
    const perPage = 100;

    for (let page = 1; page <= 10; page += 1) {
      const response = await this.client.requestJson<unknown>(path, {
        query: {
          per_page: perPage,
          page
        }
      });
      if (!Array.isArray(response)) {
        break;
      }
      result.push(...(response as T[]));
      if (response.length < perPage) {
        break;
      }
    }
    return result;
  }
}

function mapCheckRun(raw: any): PullRequestCheck {
  return {
    name: asString(raw?.name, "check-run"),
    status: normalizeStatus(raw?.status),
    conclusion: normalizeConclusion(raw?.conclusion)
  };
}

function normalizeStatus(value: unknown): PullRequestCheck["status"] {
  if (value === "queued" || value === "in_progress" || value === "completed") {
    return value;
  }
  return "completed";
}

function normalizeConclusion(value: unknown): PullRequestCheck["conclusion"] {
  if (value === null) {
    return null;
  }
  if (value === "success" || value === "failure" || value === "cancelled" || value === "timed_out" || value === "neutral") {
    return value;
  }
  return null;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}
