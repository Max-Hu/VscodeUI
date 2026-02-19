import assert from "node:assert/strict";
import test from "node:test";
import { buildDraftPrompt, buildScorePrompt } from "../src/llm/prompts.js";

test("buildScorePrompt renders template placeholders", () => {
  const prompt = buildScorePrompt({
    profile: "default",
    githubContext: {
      metadata: {
        title: "PROJ-1",
        body: "body",
        author: "alice",
        baseBranch: "main",
        headBranch: "feature",
        url: "https://github.com/acme/platform/pull/1"
      },
      files: [],
      commits: [],
      checks: [],
      comments: [],
      signals: {
        confluenceLinks: [],
        keywords: []
      }
    },
    jiraContext: {
      requestedKeys: ["PROJ-1"],
      issues: []
    },
    confluenceContext: {
      strongLinkedUrls: [],
      searchQueries: [],
      pages: []
    }
  });

  assert.match(prompt, /Scoring profile: default/);
  assert.match(prompt, /overallScore/);
  assert.ok(!prompt.includes("{{"));
});

test("buildDraftPrompt renders template placeholders", () => {
  const prompt = buildDraftPrompt({
    reviewContext: {
      prReference: { owner: "acme", repo: "platform", prNumber: 1 },
      profile: "default",
      github: {
        metadata: {
          title: "PROJ-1",
          body: "body",
          author: "alice",
          baseBranch: "main",
          headBranch: "feature",
          url: "https://github.com/acme/platform/pull/1"
        },
        files: [],
        commits: [],
        checks: [],
        comments: [],
        signals: {
          confluenceLinks: [],
          keywords: []
        }
      },
      jira: {
        requestedKeys: ["PROJ-1"],
        issues: []
      },
      confluence: {
        strongLinkedUrls: [],
        searchQueries: [],
        pages: []
      },
      traceability: {
        jiraToConfluence: {}
      }
    },
    score: {
      overallScore: 80,
      scoreBreakdown: [],
      evidence: [],
      confidence: "medium"
    }
  });

  assert.match(prompt, /Review profile: default/);
  assert.match(prompt, /"markdown"/);
  assert.ok(!prompt.includes("{{"));
});
