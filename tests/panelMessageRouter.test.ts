import assert from "node:assert/strict";
import test from "node:test";
import type { PublishCommentRequest, ReviewRequest, Stage3ReviewResult } from "../src/domain/types.js";
import { routePanelMessage } from "../src/extension/panelMessageRouter.js";

function buildStage3Result(): Stage3ReviewResult {
  return {
    context: {
      prReference: { owner: "acme", repo: "platform", prNumber: 42 },
      profile: "default",
      github: {
        metadata: {
          title: "PROJ-42 demo",
          body: "demo",
          author: "alice",
          baseBranch: "main",
          headBranch: "feature/demo",
          url: "https://github.com/acme/platform/pull/42"
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
        requestedKeys: [],
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
    },
    draft: {
      markdown: "## draft"
    },
    warnings: [],
    meta: {
      durationMs: 10,
      usedLlm: true
    }
  };
}

test("routePanelMessage routes start-review and returns review-completed", async () => {
  let capturedRequest: ReviewRequest | undefined;

  const outbound = await routePanelMessage(
    {
      type: "start-review",
      payload: {
        prLink: "https://github.com/acme/platform/pull/42",
        reviewProfile: "security",
        additionalKeywords: [" rollback ", "monitoring"]
      }
    },
    {
      async runReview(request) {
        capturedRequest = request;
        return buildStage3Result();
      },
      async publishEditedComment() {
        throw new Error("not used");
      }
    }
  );

  assert.deepEqual(capturedRequest, {
    prLink: "https://github.com/acme/platform/pull/42",
    reviewProfile: "security",
    additionalKeywords: ["rollback", "monitoring"]
  });
  assert.equal(outbound.type, "review-completed");
});

test("routePanelMessage routes publish-review and returns publish-completed", async () => {
  let capturedRequest: PublishCommentRequest | undefined;

  const outbound = await routePanelMessage(
    {
      type: "publish-review",
      payload: {
        prLink: "https://github.com/acme/platform/pull/42",
        commentBody: "edited markdown",
        confirmed: true
      }
    },
    {
      async runReview() {
        throw new Error("not used");
      },
      async publishEditedComment(request) {
        capturedRequest = request;
        return {
          published: true,
          usedEditedBody: true,
          comment: {
            id: "1",
            url: "https://github.com/acme/platform/pull/42#issuecomment-1",
            body: request.commentBody
          }
        };
      }
    }
  );

  assert.deepEqual(capturedRequest, {
    prLink: "https://github.com/acme/platform/pull/42",
    commentBody: "edited markdown",
    confirmed: true
  });
  assert.deepEqual(outbound, {
    type: "publish-completed",
    payload: {
      commentUrl: "https://github.com/acme/platform/pull/42#issuecomment-1"
    }
  });
});

test("routePanelMessage returns review-failed for unsupported messages", async () => {
  const outbound = await routePanelMessage(
    {
      type: "unknown-event",
      payload: {}
    },
    {
      async runReview() {
        throw new Error("not used");
      },
      async publishEditedComment() {
        throw new Error("not used");
      }
    }
  );

  assert.equal(outbound.type, "review-failed");
  assert.match(outbound.payload.message, /Unsupported panel message type/);
});

test("routePanelMessage returns review-failed when runReview throws", async () => {
  const outbound = await routePanelMessage(
    {
      type: "start-review",
      payload: {
        prLink: "https://github.com/acme/platform/pull/42"
      }
    },
    {
      async runReview() {
        throw new Error("copilot unavailable");
      },
      async publishEditedComment() {
        throw new Error("not used");
      }
    }
  );

  assert.deepEqual(outbound, {
    type: "review-failed",
    payload: {
      message: "copilot unavailable"
    }
  });
});
