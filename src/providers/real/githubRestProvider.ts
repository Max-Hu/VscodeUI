import type { ProviderConnectionConfig } from "../../config/types.js";
import type { GithubPullRequestPayload, PrReference, PublishedComment, PullRequestCheck } from "../../domain/types.js";
import type { IGithubProvider } from "../githubProvider.js";
import { HttpJsonClient } from "./httpJsonClient.js";

const GITHUB_ACCEPT = "application/vnd.github+json";

export interface GithubPrDiffFile {
  path: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unknown";
  previousPath?: string;
  patch?: string;
}

export interface GithubPrDiffSnapshot {
  prTitle: string;
  baseSha: string;
  headSha: string;
  files: GithubPrDiffFile[];
}

export class GithubRestProvider implements IGithubProvider {
  private readonly client: HttpJsonClient;

  constructor(connection: ProviderConnectionConfig, options?: { disableTlsValidation?: boolean }) {
    this.client = new HttpJsonClient({
      providerName: "GitHub",
      baseUrl: normalizeGithubApiBase(connection.domain),
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

  async getPullRequestDiffSnapshot(reference: PrReference): Promise<GithubPrDiffSnapshot> {
    const basePath = `/repos/${reference.owner}/${reference.repo}`;
    const pull = await this.client.requestJson<any>(`${basePath}/pulls/${reference.prNumber}`);
    const files = await this.fetchPagedArray<any>(`${basePath}/pulls/${reference.prNumber}/files`);

    const baseSha = asString(pull?.base?.sha);
    const headSha = asString(pull?.head?.sha);
    if (!baseSha || !headSha) {
      throw new Error("GitHub PR diff is missing base/head commit SHA.");
    }

    return {
      prTitle: asString(pull?.title, `PR #${reference.prNumber}`),
      baseSha,
      headSha,
      files: files.map((file) => ({
        path: asString(file?.filename, "unknown"),
        status: normalizePrFileStatus(file?.status),
        previousPath: asString(file?.previous_filename) || undefined,
        patch: asString(file?.patch) || undefined
      }))
    };
  }

  async getTextFileContentAtRef(reference: PrReference, path: string, ref: string): Promise<string | undefined> {
    const normalizedPath = path.trim();
    const normalizedRef = ref.trim();
    if (!normalizedPath || !normalizedRef) {
      return undefined;
    }
    const endpoint = `/repos/${reference.owner}/${reference.repo}/contents/${encodeGitHubPath(normalizedPath)}`;
    try {
      const response = await this.client.requestJson<any>(endpoint, {
        query: {
          ref: normalizedRef
        }
      });
      const encodedContent = asString(response?.content);
      const encoding = asString(response?.encoding).toLowerCase();
      if (!encodedContent || encoding !== "base64") {
        return undefined;
      }
      const decoded = Buffer.from(encodedContent.replace(/\s+/g, ""), "base64").toString("utf8");
      if (looksBinary(decoded)) {
        return undefined;
      }
      return decoded;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/\brequest failed: 404\b/i.test(message)) {
        return undefined;
      }
      throw error;
    }
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

function normalizePrFileStatus(value: unknown): GithubPrDiffFile["status"] {
  if (
    value === "added" ||
    value === "removed" ||
    value === "modified" ||
    value === "renamed" ||
    value === "copied" ||
    value === "changed"
  ) {
    return value;
  }
  return "unknown";
}

function encodeGitHubPath(path: string): string {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function looksBinary(text: string): boolean {
  if (!text) {
    return false;
  }
  if (text.includes("\u0000")) {
    return true;
  }
  let suspicious = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const isAllowedControl = code === 9 || code === 10 || code === 13;
    const isPrintable = code >= 32 && code !== 127;
    if (!isAllowedControl && !isPrintable) {
      suspicious += 1;
    }
  }
  return suspicious / Math.max(1, text.length) > 0.15;
}

function normalizeGithubApiBase(domain: string): string {
  const normalized = domain.trim().replace(/\/+$/, "");
  if (!normalized) {
    return normalized;
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("GitHub provider domain must be a valid URL and match https://{host}/api/v3.");
  }
  if (!/\/api\/v3$/i.test(parsed.pathname.replace(/\/+$/, ""))) {
    throw new Error("GitHub provider domain must match https://{host}/api/v3.");
  }
  return normalized;
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
