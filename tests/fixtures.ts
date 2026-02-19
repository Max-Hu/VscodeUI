import type { ConfluencePageContext, GithubPullRequestPayload, JiraIssueContext } from "../src/domain/types.js";

export const fixturePullRequest: GithubPullRequestPayload = {
  metadata: {
    title: "PROJ-123 Add order retry policy",
    body: "Implements retry policy for payment callback. Linked docs: https://example.atlassian.net/wiki/spaces/ENG/pages/101",
    author: "alice",
    baseBranch: "main",
    headBranch: "feature/order-retry",
    url: "https://github.com/acme/platform/pull/42"
  },
  files: [
    {
      path: "src/order/retry.ts",
      patch: "+++ add retry policy\n+ export function shouldRetry() { return true; }\n"
    },
    {
      path: "tests/order/retry.test.ts",
      patch: "+++ add tests\n+ describe('retry', () => { it('works', () => {}); });\n"
    }
  ],
  commits: [
    { sha: "a1", message: "PROJ-123 add retry policy logic" },
    { sha: "a2", message: "PROJ-124 improve timeout handling" }
  ],
  checks: [
    { name: "unit-tests", status: "completed", conclusion: "success" },
    { name: "lint", status: "completed", conclusion: "success" }
  ],
  comments: [
    {
      author: "reviewer",
      body: "Please confirm rollback plan."
    }
  ]
};

export const fixtureIssues: JiraIssueContext[] = [
  {
    key: "PROJ-123",
    summary: "Implement retry policy",
    description: "Need retry policy for callback failures",
    acceptanceCriteria: ["Retries max 3 times", "Log retries"],
    nfr: ["No P99 regression"],
    risks: ["Potential duplicate callback"],
    testingRequirements: ["Unit tests for retry count"],
    links: ["https://example.atlassian.net/wiki/spaces/ENG/pages/101"]
  },
  {
    key: "PROJ-124",
    summary: "Timeout handling",
    description: "Improve timeout edge case handling",
    acceptanceCriteria: ["Timeout is configurable"],
    nfr: ["No memory leak"],
    risks: ["Timeout too small can fail fast"],
    testingRequirements: ["Timeout integration tests"],
    links: ["https://example.atlassian.net/wiki/spaces/ENG/pages/102"]
  }
];

export const fixtureConfluencePages: ConfluencePageContext[] = [
  {
    id: "101",
    title: "PROJ-123 Callback Retry Design",
    url: "https://example.atlassian.net/wiki/spaces/ENG/pages/101",
    content: "Scope, API contract, security and rollback strategy for PROJ-123.",
    source: "issue-link"
  },
  {
    id: "102",
    title: "Timeout Handling for PROJ-124",
    url: "https://example.atlassian.net/wiki/spaces/ENG/pages/102",
    content: "Requirements and monitoring plan for timeout behavior.",
    source: "issue-link"
  },
  {
    id: "205",
    title: "Retry Monitoring Runbook",
    url: "https://example.atlassian.net/wiki/spaces/SRE/pages/205",
    content: "Monitoring and rollback checklist for retry incidents.",
    source: "keyword-query"
  }
];
