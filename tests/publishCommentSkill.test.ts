import assert from "node:assert/strict";
import test from "node:test";
import { defaultStage1Config } from "../src/config/defaults.js";
import { PublishCommentSkill } from "../src/skills/publishCommentSkill.js";
import type { SkillContext } from "../src/skills/context.js";

function buildContext(): SkillContext {
  return {
    config: defaultStage1Config,
    providers: {
      github: {
        async getPullRequest() {
          throw new Error("not used");
        },
        async publishReviewComment(_reference, commentBody) {
          return {
            id: "1",
            url: "https://github.com/acme/platform/pull/42#issuecomment-1",
            body: commentBody
          };
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

test("PublishCommentSkill publishes edited body after confirmation", async () => {
  const skill = new PublishCommentSkill();
  const result = await skill.run(
    {
      prReference: { owner: "acme", repo: "platform", prNumber: 42 },
      commentBody: "edited comment from user",
      confirmed: true
    },
    buildContext()
  );

  assert.equal(result.result.published, true);
  assert.equal(result.result.usedEditedBody, true);
  assert.equal(result.result.comment.body, "edited comment from user");
});

test("PublishCommentSkill rejects publish when confirmation is missing", async () => {
  const skill = new PublishCommentSkill();
  await assert.rejects(
    () =>
      skill.run(
        {
          prReference: { owner: "acme", repo: "platform", prNumber: 42 },
          commentBody: "edited comment from user",
          confirmed: false
        },
        buildContext()
      ),
    /requires explicit confirmation/
  );
});
