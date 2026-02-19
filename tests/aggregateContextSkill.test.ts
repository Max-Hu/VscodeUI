import assert from "node:assert/strict";
import test from "node:test";
import { defaultStage1Config } from "../src/config/defaults.js";
import { AggregateContextSkill } from "../src/skills/aggregateContextSkill.js";
import type { SkillContext } from "../src/skills/context.js";

const context: SkillContext = {
  config: {
    ...defaultStage1Config,
    topK: 2
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

test("AggregateContextSkill ranks confluence pages and builds traceability map", async () => {
  const skill = new AggregateContextSkill();
  const result = await skill.run(
    {
      prReference: { owner: "acme", repo: "platform", prNumber: 42 },
      profile: "default",
      githubContext: {
        metadata: {
          title: "PROJ-123 feature",
          body: "",
          author: "alice",
          baseBranch: "main",
          headBranch: "feature",
          url: "https://github.com/acme/platform/pull/42"
        },
        files: [],
        commits: [],
        checks: [],
        comments: [],
        signals: {
          confluenceLinks: [],
          keywords: ["retry", "rollback"]
        }
      },
      jiraContext: {
        requestedKeys: ["PROJ-123", "PROJ-124"],
        issues: []
      },
      confluenceContext: {
        strongLinkedUrls: ["https://example.atlassian.net/wiki/spaces/ENG/pages/101"],
        searchQueries: ["PROJ-123", "retry"],
        pages: [
          {
            id: "101",
            title: "PROJ-123 API contract",
            url: "https://example.atlassian.net/wiki/spaces/ENG/pages/101",
            content: "rollback plan for PROJ-123",
            source: "issue-link"
          },
          {
            id: "205",
            title: "Retry runbook",
            url: "https://example.atlassian.net/wiki/spaces/SRE/pages/205",
            content: "rollback checklist",
            source: "keyword-query"
          },
          {
            id: "300",
            title: "Unrelated page",
            url: "https://example.atlassian.net/wiki/spaces/OPS/pages/300",
            content: "legacy docs",
            source: "keyword-query"
          }
        ]
      }
    },
    context
  );

  assert.equal(result.reviewContext.confluence.pages.length, 2);
  assert.ok((result.reviewContext.confluence.pages[0].relevanceScore ?? 0) >= (result.reviewContext.confluence.pages[1].relevanceScore ?? 0));
  assert.deepEqual(result.reviewContext.traceability.jiraToConfluence["PROJ-123"], [
    "https://example.atlassian.net/wiki/spaces/ENG/pages/101"
  ]);
  assert.deepEqual(result.reviewContext.traceability.jiraToConfluence["PROJ-124"], []);
});
