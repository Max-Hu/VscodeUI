import assert from "node:assert/strict";
import test from "node:test";
import { defaultStage1Config } from "../src/config/defaults.js";
import { ScorePrSkill } from "../src/skills/scorePrSkill.js";
import type { SkillContext } from "../src/skills/context.js";
import { fixtureIssues, fixturePullRequest } from "./fixtures.js";

const context: SkillContext = {
  config: defaultStage1Config,
  llm: {
    async generate() {
      return JSON.stringify({
        overallScore: 83,
        scoreBreakdown: [
          { dimension: "Correctness", score: 85, rationale: "ok" },
          { dimension: "Maintainability", score: 82, rationale: "ok" },
          { dimension: "Reliability", score: 84, rationale: "ok" },
          { dimension: "Security", score: 81, rationale: "ok" },
          { dimension: "Performance", score: 80, rationale: "ok" },
          { dimension: "Test Quality", score: 86, rationale: "ok" },
          { dimension: "Traceability", score: 83, rationale: "ok" }
        ],
        evidence: [{ snippet: "from llm" }],
        confidence: "high"
      });
    }
  },
  providers: {
    github: {
      async getPullRequest() {
        throw new Error("not used");
      },
      async publishReviewComment() {
        throw new Error("not used");
      }
    },
    jira: {
      async getIssues() {
        throw new Error("not used");
      }
    },
    confluence: {
      async getPagesByUrls() {
        throw new Error("not used");
      },
      async searchPages() {
        throw new Error("not used");
      }
    }
  }
};

test("ScorePrSkill computes weighted score in range", async () => {
  const skill = new ScorePrSkill();
  const result = await skill.run(
    {
      githubContext: {
        ...fixturePullRequest,
        files: fixturePullRequest.files.map((f) => ({ ...f, truncated: false })),
        signals: { confluenceLinks: [], keywords: ["security", "retry"] }
      },
      jiraContext: {
        requestedKeys: ["PROJ-123", "PROJ-124"],
        issues: fixtureIssues
      },
      confluenceContext: {
        strongLinkedUrls: [],
        searchQueries: [],
        pages: [
          {
            id: "c1",
            title: "PROJ-123 API contract",
            url: "https://example.atlassian.net/wiki/spaces/ENG/pages/101",
            content: "contract and rollback plan",
            source: "jira-query",
            matchedJiraKeys: ["PROJ-123"],
            matchedKeywords: ["retry"],
            relevanceScore: 78
          }
        ]
      },
      profile: "default"
    },
    context
  );

  assert.ok(result.score.overallScore >= 0 && result.score.overallScore <= 100);
  assert.equal(result.score.scoreBreakdown.length, 7);
  assert.ok(result.score.evidence.length > 0);
});
