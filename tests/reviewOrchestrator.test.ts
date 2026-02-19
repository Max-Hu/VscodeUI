import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryReviewObserver } from "../src/observability/reviewObserver.js";
import { Stage1ReviewOrchestrator } from "../src/orchestrator/reviewOrchestrator.js";
import { MockConfluenceProvider } from "../src/providers/mocks/mockConfluenceProvider.js";
import { MockGithubProvider } from "../src/providers/mocks/mockGithubProvider.js";
import { MockJiraProvider } from "../src/providers/mocks/mockJiraProvider.js";
import { fixtureConfluencePages, fixtureIssues, fixturePullRequest } from "./fixtures.js";

function createLlmForTests() {
  return {
    async generate(prompt: string) {
      if (prompt.includes("Generate a PR review markdown draft")) {
        return JSON.stringify({
          markdown: "## PR Review Draft\n\n- PROJ-123 from llm\n\n### Confluence Context"
        });
      }
      return JSON.stringify({
        overallScore: 82,
        scoreBreakdown: [
          { dimension: "Correctness", score: 84, rationale: "ok" },
          { dimension: "Maintainability", score: 81, rationale: "ok" },
          { dimension: "Reliability", score: 83, rationale: "ok" },
          { dimension: "Security", score: 80, rationale: "ok" },
          { dimension: "Performance", score: 79, rationale: "ok" },
          { dimension: "Test Quality", score: 86, rationale: "ok" },
          { dimension: "Traceability", score: 82, rationale: "ok" }
        ],
        evidence: [{ snippet: "llm-evidence" }],
        confidence: "high"
      });
    }
  };
}

test("Stage1ReviewOrchestrator runs PR -> Jira -> Confluence -> Score -> Draft pipeline", async () => {
  const githubProvider = new MockGithubProvider({
    "acme/platform#42": fixturePullRequest
  });
  const jiraProvider = new MockJiraProvider(fixtureIssues);
  const confluenceProvider = new MockConfluenceProvider({
    byUrl: {
      [fixtureConfluencePages[0].url]: fixtureConfluencePages[0],
      [fixtureConfluencePages[1].url]: fixtureConfluencePages[1]
    },
    byQuery: {
      retry: [fixtureConfluencePages[2]]
    }
  });
  const orchestrator = new Stage1ReviewOrchestrator({
    githubProvider,
    jiraProvider,
    confluenceProvider,
    llmProvider: createLlmForTests()
  });

  const result = await orchestrator.run({
    prLink: "https://github.com/acme/platform/pull/42",
    reviewProfile: "security"
  });

  assert.equal(result.context.prReference.owner, "acme");
  assert.equal(result.context.profile, "default");
  assert.equal(result.context.jira.issues.length, 2);
  assert.ok(result.context.confluence.pages.length > 0);
  assert.ok(result.context.traceability.jiraToConfluence["PROJ-123"].length > 0);
  assert.ok(result.score.overallScore > 0);
  assert.match(result.draft.markdown, /PR Review Draft/);
  assert.match(result.draft.markdown, /PROJ-123/);
  assert.match(result.draft.markdown, /Confluence Context/);
  assert.ok(result.meta.durationMs >= 0);
});

test("Stage1ReviewOrchestrator publishes edited comment body after confirmation", async () => {
  const githubProvider = new MockGithubProvider({
    "acme/platform#42": fixturePullRequest
  });
  const orchestrator = new Stage1ReviewOrchestrator({
    githubProvider,
    jiraProvider: new MockJiraProvider(fixtureIssues),
    confluenceProvider: new MockConfluenceProvider({}),
    llmProvider: createLlmForTests()
  });

  const result = await orchestrator.publishEditedComment({
    prLink: "https://github.com/acme/platform/pull/42",
    commentBody: "edited by human reviewer",
    confirmed: true
  });

  assert.equal(result.published, true);
  assert.equal(result.comment.body, "edited by human reviewer");
});

test("Stage1ReviewOrchestrator degrades when confluence fails and resilience enabled", async () => {
  const observer = new InMemoryReviewObserver();
  const orchestrator = new Stage1ReviewOrchestrator({
    githubProvider: new MockGithubProvider({
      "acme/platform#42": fixturePullRequest
    }),
    jiraProvider: new MockJiraProvider(fixtureIssues),
    confluenceProvider: {
      async getPagesByUrls() {
        throw new Error("confluence unavailable");
      },
      async searchPages() {
        throw new Error("confluence unavailable");
      }
    },
    reviewObserver: observer,
    llmProvider: createLlmForTests(),
    config: {
      resilience: {
        continueOnConfluenceError: true
      }
    }
  });

  const result = await orchestrator.run({
    prLink: "https://github.com/acme/platform/pull/42"
  });

  assert.ok((result.warnings ?? []).some((message) => /Confluence retrieval failed/.test(message)));
  assert.equal(result.context.confluence.pages.length, 0);
  assert.ok(observer.getEvents().some((event) => event.name === "degraded" && event.step === "fetch-confluence-context"));
});
