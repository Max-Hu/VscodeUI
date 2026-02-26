import type {
  ConfluencePageContext,
  GithubPullRequestPayload,
  JiraIssueContext,
  PrReference,
  PublishedComment
} from "../../domain/types.js";
import type { GithubPrDiffSnapshot } from "../real/githubRestProvider.js";
import type { IConfluenceProvider } from "../confluenceProvider.js";
import type { IGithubProvider } from "../githubProvider.js";
import type { IJiraProvider } from "../jiraProvider.js";

export class DemoGithubProvider implements IGithubProvider {
  private readonly published: PublishedComment[] = [];

  async getPullRequest(reference: PrReference): Promise<GithubPullRequestPayload> {
    const jiraKey = toJiraKey(reference.prNumber);
    return {
      metadata: {
        title: `${jiraKey} Demo review for ${reference.owner}/${reference.repo}`,
        body: [
          `This is a stage-4 demo payload for PR #${reference.prNumber}.`,
          `Confluence: https://example.atlassian.net/wiki/spaces/ENG/pages/${1000 + reference.prNumber}`
        ].join("\n"),
        author: "demo-user",
        baseBranch: "main",
        headBranch: `feature/demo-${reference.prNumber}`,
        url: `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.prNumber}`
      },
      files: [
        {
          path: "src/service/orderService.ts",
          patch: [
            "+ export async function processOrder(orderId: string) {",
            "+   // TODO: idempotency",
            "+   return orderId.length > 0;",
            "+ }"
          ].join("\n")
        },
        {
          path: "tests/service/orderService.test.ts",
          patch: [
            "+ describe('processOrder', () => {",
            "+   it('returns true for non-empty id', async () => {",
            "+     expect(await processOrder('o-1')).toBe(true);",
            "+   });",
            "+ });"
          ].join("\n")
        }
      ],
      commits: [
        {
          sha: `demo-${reference.prNumber}-1`,
          message: `${jiraKey} implement order processing path`
        },
        {
          sha: `demo-${reference.prNumber}-2`,
          message: `${jiraKey} add unit tests and update logging`
        }
      ],
      checks: [
        {
          name: "unit-tests",
          status: "completed",
          conclusion: "success"
        },
        {
          name: "lint",
          status: "completed",
          conclusion: "success"
        }
      ],
      comments: [
        {
          author: "review-bot",
          body: "Please verify rollback safety and monitoring."
        }
      ]
    };
  }

  async publishReviewComment(reference: PrReference, commentBody: string): Promise<PublishedComment> {
    const comment: PublishedComment = {
      id: `demo-comment-${this.published.length + 1}`,
      url: `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.prNumber}#issuecomment-${this.published.length + 1}`,
      body: commentBody
    };
    this.published.push(comment);
    return comment;
  }

  async getPullRequestDiffSnapshot(reference: PrReference): Promise<GithubPrDiffSnapshot> {
    const pr = await this.getPullRequest(reference);
    return {
      prTitle: pr.metadata.title,
      baseSha: `demo-base-${reference.prNumber}`,
      headSha: `demo-head-${reference.prNumber}`,
      files: pr.files.map((file) => ({
        path: file.path,
        status: inferDemoDiffStatus(file.patch),
        patch: file.patch || undefined
      }))
    };
  }

  async getTextFileContentAtRef(reference: PrReference, path: string, ref: string): Promise<string | undefined> {
    const pr = await this.getPullRequest(reference);
    const target = pr.files.find((file) => file.path === path);
    if (!target) {
      return undefined;
    }

    const side = isDemoHeadRef(ref, reference.prNumber) ? "head" : "base";
    return renderDemoFileContentFromPatch(target.path, target.patch, side);
  }
}

export class DemoJiraProvider implements IJiraProvider {
  async getIssues(keys: string[], _options: { expandDepth: number }): Promise<JiraIssueContext[]> {
    return keys.map((key) => ({
      key,
      summary: `Demo issue summary for ${key}`,
      description: `Demo description and acceptance notes for ${key}.`,
      acceptanceCriteria: ["Feature works for happy path", "Failure path returns controlled errors"],
      nfr: ["No significant latency regression", "No memory leak"],
      risks: ["Idempotency handling may be incomplete"],
      testingRequirements: ["Add unit tests", "Validate monitoring alerts"],
      links: [jiraKeyToConfluenceUrl(key)]
    }));
  }
}

export class DemoConfluenceProvider implements IConfluenceProvider {
  async getPagesByUrls(
    urls: string[],
    _options: { expandDepth: number }
  ): Promise<ConfluencePageContext[]> {
    return urls.map((url, index) => ({
      id: `demo-url-${index + 1}`,
      title: `Design Doc ${index + 1}`,
      url,
      content: `Scope, API contract, rollback and monitoring notes for ${url}.`,
      source: "issue-link"
    }));
  }

  async searchPages(
    query: string,
    options: { topK: number; expandDepth: number }
  ): Promise<ConfluencePageContext[]> {
    const normalized = query.trim();
    if (!normalized) {
      return [];
    }

    const pages: ConfluencePageContext[] = [
      {
        id: `demo-search-${slug(normalized)}-1`,
        title: `${normalized} - Technical Notes`,
        url: `https://example.atlassian.net/wiki/spaces/ENG/pages/${20000 + Math.min(9999, normalized.length * 13)}`,
        content: `Search result content related to ${normalized}.`,
        source: "keyword-query"
      },
      {
        id: `demo-search-${slug(normalized)}-2`,
        title: `${normalized} - Monitoring Guide`,
        url: `https://example.atlassian.net/wiki/spaces/SRE/pages/${30000 + Math.min(9999, normalized.length * 17)}`,
        content: `Runbook and dashboards for ${normalized}.`,
        source: "keyword-query"
      }
    ];

    return pages.slice(0, options.topK);
  }
}

function toJiraKey(prNumber: number): string {
  return `PROJ-${Math.max(1, prNumber)}`;
}

function jiraKeyToConfluenceUrl(key: string): string {
  const digits = key.match(/\d+/)?.[0] ?? "1";
  return `https://example.atlassian.net/wiki/spaces/ENG/pages/${1000 + Number(digits)}`;
}

function slug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function inferDemoDiffStatus(patch: string): "added" | "removed" | "modified" {
  const lines = patch.split(/\r?\n/);
  let hasAdded = false;
  let hasRemoved = false;

  for (const line of lines) {
    if (line.startsWith("+++ ") || line.startsWith("--- ") || line.startsWith("@@")) {
      continue;
    }
    if (line.startsWith("+")) {
      hasAdded = true;
    } else if (line.startsWith("-")) {
      hasRemoved = true;
    }
  }

  if (hasAdded && !hasRemoved) {
    return "added";
  }
  if (!hasAdded && hasRemoved) {
    return "removed";
  }
  return "modified";
}

function isDemoHeadRef(ref: string, prNumber: number): boolean {
  return ref.trim() === `demo-head-${prNumber}`;
}

function renderDemoFileContentFromPatch(path: string, patch: string, side: "base" | "head"): string {
  if (!patch.trim()) {
    return side === "head" ? `// Demo patch unavailable for ${path}\n` : "";
  }

  const output: string[] = [];
  for (const rawLine of patch.split(/\r?\n/)) {
    if (rawLine.startsWith("diff --git ") || rawLine.startsWith("index ") || rawLine.startsWith("@@")) {
      continue;
    }
    if (rawLine.startsWith("\\ No newline at end of file")) {
      continue;
    }
    if (rawLine.startsWith("+++ ") || rawLine.startsWith("--- ")) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      if (side === "head") {
        output.push(rawLine.slice(1));
      }
      continue;
    }
    if (rawLine.startsWith("-")) {
      if (side === "base") {
        output.push(rawLine.slice(1));
      }
      continue;
    }
    if (rawLine.startsWith(" ")) {
      output.push(rawLine.slice(1));
      continue;
    }

    output.push(rawLine);
  }

  if (output.length > 0) {
    return `${output.join("\n")}\n`;
  }

  return side === "head" ? `// Demo generated content for ${path}\n` : "";
}
