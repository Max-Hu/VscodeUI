import assert from "node:assert/strict";
import test from "node:test";
import { buildStage1ConfigPatchFromStructuredSettings } from "../src/config/vscodeSettings.js";

test("buildStage1ConfigPatchFromStructuredSettings maps structured providers and runtime switches", () => {
  const patch = buildStage1ConfigPatchFromStructuredSettings({
    providers: {
      github: {
        domain: "https://alm-github.test/api/v3",
        credential: {
          tokenRef: "github_token"
        }
      },
      jira: {
        domain: "https://alm-jira.test/jira",
        credential: {
          tokenRef: "jira_token"
        }
      },
      confluence: {
        domain: "https://alm-confluence.test/confluence",
        enableExpandedSearch: true,
        credential: {
          tokenRef: "confluence_token"
        }
      }
    },
    llm: {
      mode: "copilot"
    },
    post: {
      enabled: true,
      requireConfirmation: true
    },
    resilience: {
      continueOnConfluenceError: true
    },
    observability: {
      enabled: false,
      verboseLogs: true
    }
  });

  assert.deepEqual(patch, {
    providers: {
      github: {
        domain: "https://alm-github.test/api/v3",
        credential: {
          tokenRef: "github_token"
        }
      },
      jira: {
        domain: "https://alm-jira.test/jira",
        credential: {
          tokenRef: "jira_token"
        }
      },
      confluence: {
        domain: "https://alm-confluence.test/confluence",
        enableExpandedSearch: true,
        credential: {
          tokenRef: "confluence_token"
        }
      }
    },
    llm: {
      mode: "copilot"
    },
    post: {
      enabled: true,
      requireConfirmation: true
    },
    resilience: {
      continueOnConfluenceError: true
    },
    observability: {
      enabled: false,
      verboseLogs: true
    }
  });
});

test("buildStage1ConfigPatchFromStructuredSettings maps llm.useMock and overrides llm.mode", () => {
  const patch = buildStage1ConfigPatchFromStructuredSettings({
    llm: {
      mode: "copilot",
      useMock: true
    }
  });

  assert.deepEqual(patch, {
    llm: {
      mode: "mock"
    }
  });
});

test("buildStage1ConfigPatchFromStructuredSettings ignores non-object root", () => {
  assert.deepEqual(buildStage1ConfigPatchFromStructuredSettings("invalid"), {});
  assert.deepEqual(buildStage1ConfigPatchFromStructuredSettings(undefined), {});
});

test("buildStage1ConfigPatchFromStructuredSettings rejects github basic credentials", () => {
  assert.throws(
    () =>
      buildStage1ConfigPatchFromStructuredSettings({
        providers: {
          github: {
            credential: {
              usernameRef: "github_user",
              passwordRef: "github_pass"
            }
          }
        }
      }),
    /github\.credential only supports token/i
  );
});

test("buildStage1ConfigPatchFromStructuredSettings rejects jira basic credentials", () => {
  assert.throws(
    () =>
      buildStage1ConfigPatchFromStructuredSettings({
        providers: {
          jira: {
            credential: {
              usernameRef: "jira_user",
              passwordRef: "jira_pass"
            }
          }
        }
      }),
    /jira\.credential only supports token/i
  );
});

test("buildStage1ConfigPatchFromStructuredSettings rejects legacy credential.mode", () => {
  assert.throws(
    () =>
      buildStage1ConfigPatchFromStructuredSettings({
        providers: {
          confluence: {
            credential: {
              mode: "oauth",
              tokenRef: "confluence_token"
            }
          }
        }
      }),
    /credential\.mode is not supported/i
  );
});

test("buildStage1ConfigPatchFromStructuredSettings rejects unsupported provider domain shapes", () => {
  assert.throws(
    () =>
      buildStage1ConfigPatchFromStructuredSettings({
        providers: {
          github: {
            domain: "https://alm-github.test",
            credential: {
              tokenRef: "github_token"
            }
          }
        }
      }),
    /github\.domain must match .*\/api\/v3/i
  );
});
