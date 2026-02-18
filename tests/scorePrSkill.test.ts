import assert from "node:assert/strict";
import test from "node:test";
import { defaultStage1Config } from "../src/config/defaults.js";
import { ScorePrSkill } from "../src/skills/scorePrSkill.js";
import type { SkillContext } from "../src/skills/context.js";
import { fixtureIssues, fixturePullRequest } from "./fixtures.js";

const context: SkillContext = {
  config: defaultStage1Config,
  providers: {
    github: {
      async getPullRequest() {
        throw new Error("not used");
      }
    },
    jira: {
      async getIssues() {
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
      profile: "default"
    },
    context
  );

  assert.ok(result.score.overallScore >= 0 && result.score.overallScore <= 100);
  assert.equal(result.score.scoreBreakdown.length, 7);
  assert.ok(result.score.evidence.length > 0);
});
