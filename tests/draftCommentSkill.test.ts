import assert from "node:assert/strict";
import test from "node:test";
import { defaultStage1Config } from "../src/config/defaults.js";
import type { ReviewContext, ScoreResult } from "../src/domain/types.js";
import { DraftCommentSkill } from "../src/skills/draftCommentSkill.js";
import type { SkillContext } from "../src/skills/context.js";

function buildReviewContext(): ReviewContext {
  return {
    prReference: {
      owner: "acme",
      repo: "platform",
      prNumber: 42
    },
    profile: "default",
    github: {
      metadata: {
        title: "PROJ-123 retry",
        body: "body",
        author: "alice",
        baseBranch: "main",
        headBranch: "feature/retry",
        url: "https://github.com/acme/platform/pull/42"
      },
      files: [],
      commits: [],
      checks: [],
      comments: [],
      signals: {
        confluenceLinks: [],
        keywords: ["retry"]
      }
    },
    jira: {
      requestedKeys: ["PROJ-123"],
      issues: [
        {
          key: "PROJ-123",
          summary: "Retry policy",
          description: "",
          acceptanceCriteria: [],
          nfr: [],
          risks: [],
          testingRequirements: []
        }
      ]
    },
    confluence: {
      strongLinkedUrls: [],
      searchQueries: [],
      pages: []
    },
    traceability: {
      jiraToConfluence: {
        "PROJ-123": []
      }
    }
  };
}

function buildScore(): ScoreResult {
  return {
    overallScore: 80,
    scoreBreakdown: [
      {
        dimension: "Correctness",
        score: 80,
        weight: 0.24,
        rationale: "ok"
      },
      {
        dimension: "Maintainability",
        score: 80,
        weight: 0.14,
        rationale: "ok"
      },
      {
        dimension: "Reliability",
        score: 80,
        weight: 0.18,
        rationale: "ok"
      },
      {
        dimension: "Security",
        score: 80,
        weight: 0.14,
        rationale: "ok"
      },
      {
        dimension: "Performance",
        score: 80,
        weight: 0.1,
        rationale: "ok"
      },
      {
        dimension: "Test Quality",
        score: 80,
        weight: 0.1,
        rationale: "ok"
      },
      {
        dimension: "Traceability",
        score: 80,
        weight: 0.1,
        rationale: "ok"
      }
    ],
    evidence: [],
    confidence: "medium"
  };
}

function baseContext(): SkillContext {
  return {
    config: {
      ...defaultStage1Config,
      llm: {
        mode: "mock"
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
}

test("DraftCommentSkill uses llm markdown when json response is valid", async () => {
  const skill = new DraftCommentSkill();
  const context = baseContext();
  context.llm = {
    async generate() {
      return JSON.stringify({ markdown: "## LLM Draft\n\n- generated" });
    }
  };

  const result = await skill.run(
    {
      reviewContext: buildReviewContext(),
      score: buildScore()
    },
    context
  );

  assert.equal(result.usedLlm, true);
  assert.match(result.draft.markdown, /LLM Draft/);
});

test("DraftCommentSkill throws when llm response is invalid", async () => {
  const skill = new DraftCommentSkill();
  const context = baseContext();
  context.llm = {
    async generate() {
      return "NOT_JSON";
    }
  };

  await assert.rejects(
    () =>
      skill.run(
        {
          reviewContext: buildReviewContext(),
          score: buildScore()
        },
        context
      ),
    /invalid/i
  );
});
