import { Stage1ReviewOrchestrator } from "../src/orchestrator/reviewOrchestrator.js";
import { MockGithubProvider } from "../src/providers/mocks/mockGithubProvider.js";
import { MockJiraProvider } from "../src/providers/mocks/mockJiraProvider.js";

const githubProvider = new MockGithubProvider({
  "acme/platform#42": {
    metadata: {
      title: "PROJ-123 Add retry policy",
      body: "Improve callback reliability",
      author: "alice",
      baseBranch: "main",
      headBranch: "feature/retry",
      url: "https://github.com/acme/platform/pull/42"
    },
    files: [
      { path: "src/retry.ts", patch: "+ export const retry = true;" },
      { path: "tests/retry.test.ts", patch: "+ it('retries', () => {})" }
    ],
    commits: [
      { sha: "1", message: "PROJ-123 add retry logic" },
      { sha: "2", message: "PROJ-124 improve timeout handling" }
    ],
    checks: [{ name: "unit-tests", status: "completed", conclusion: "success" }],
    comments: []
  }
});

const jiraProvider = new MockJiraProvider([
  {
    key: "PROJ-123",
    summary: "Retry policy for callback",
    description: "Add bounded retry policy",
    acceptanceCriteria: ["Retries <= 3"],
    nfr: ["No P99 increase"],
    risks: ["Duplicate callback risk"],
    testingRequirements: ["Retry unit tests"]
  },
  {
    key: "PROJ-124",
    summary: "Timeout handling",
    description: "Tune timeout fallback",
    acceptanceCriteria: ["Fallback on timeout"],
    nfr: ["No memory leak"],
    risks: ["Aggressive timeout"],
    testingRequirements: ["Timeout integration test"]
  }
]);

const orchestrator = new Stage1ReviewOrchestrator({ githubProvider, jiraProvider });

const result = await orchestrator.run({
  prLink: "https://github.com/acme/platform/pull/42",
  reviewProfile: "default"
});

console.log(JSON.stringify(result, null, 2));
