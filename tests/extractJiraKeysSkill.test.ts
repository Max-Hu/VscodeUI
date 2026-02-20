import assert from "node:assert/strict";
import test from "node:test";
import { defaultStage1Config } from "../src/config/defaults.js";
import { ExtractJiraKeysSkill } from "../src/skills/extractJiraKeysSkill.js";
import type { SkillContext } from "../src/skills/context.js";

const context: SkillContext = {
  config: defaultStage1Config,
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

test("ExtractJiraKeysSkill returns deduplicated sorted keys from title, branches and commits (case-insensitive)", async () => {
  const skill = new ExtractJiraKeysSkill();
  const result = await skill.run(
    {
      githubContext: {
        metadata: {
          title: "feat: add fallback for proj-3",
          body: "",
          author: "",
          baseBranch: "release/proj-1",
          headBranch: "feature/PROJ-2-hardening",
          url: ""
        },
        files: [],
        commits: [
          { sha: "1", message: "misc cleanup without jira id" },
          { sha: "2", message: "proj-2 duplicate lower should still match now" },
          { sha: "3", message: "PROJ-1 add B" }
        ],
        checks: [],
        comments: [],
        signals: { confluenceLinks: [], keywords: [] }
      }
    },
    context
  );

  assert.deepEqual(result.jiraKeys, ["PROJ-1", "PROJ-2", "PROJ-3"]);
});
