import assert from "node:assert/strict";
import test from "node:test";
import { buildStage1ConfigPatchFromFlatSettings } from "../src/config/vscodeSettings.js";

test("buildStage1ConfigPatchFromFlatSettings maps github jira and confluence provider settings", () => {
  const patch = buildStage1ConfigPatchFromFlatSettings({
    "providers.github.domain": "https://api.github.com",
    "providers.github.credential.mode": "pat",
    "providers.github.credential.tokenRef": "github_pat",
    "providers.jira.domain": "https://acme.atlassian.net",
    "providers.jira.credential.mode": "basic",
    "providers.jira.credential.usernameRef": "jira_user",
    "providers.jira.credential.passwordRef": "jira_pass",
    "providers.confluence.domain": "https://acme.atlassian.net/wiki",
    "providers.confluence.credential.mode": "oauth",
    "providers.confluence.credential.tokenRef": "confluence_token",
    "llm.mode": "copilot",
    "post.enabled": true,
    "post.requireConfirmation": true,
    "resilience.continueOnConfluenceError": true,
    "observability.enabled": false
  });

  assert.deepEqual(patch, {
    providers: {
      github: {
        domain: "https://api.github.com",
        credential: {
          mode: "pat",
          tokenRef: "github_pat"
        }
      },
      jira: {
        domain: "https://acme.atlassian.net",
        credential: {
          mode: "basic",
          usernameRef: "jira_user",
          passwordRef: "jira_pass"
        }
      },
      confluence: {
        domain: "https://acme.atlassian.net/wiki",
        credential: {
          mode: "oauth",
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
      enabled: false
    }
  });
});

test("buildStage1ConfigPatchFromFlatSettings ignores unsupported credential mode", () => {
  const patch = buildStage1ConfigPatchFromFlatSettings({
    "providers.github.credential.mode": "invalid-mode",
    "providers.github.credential.token": "dev-only-token"
  });

  assert.deepEqual(patch, {
    providers: {
      github: {
        domain: "",
        credential: {
          mode: "none",
          token: "dev-only-token"
        }
      }
    }
  });
});

test("buildStage1ConfigPatchFromFlatSettings maps llm.useMock and overrides llm.mode", () => {
  const patch = buildStage1ConfigPatchFromFlatSettings({
    "llm.mode": "copilot",
    "llm.useMock": true
  });

  assert.deepEqual(patch, {
    llm: {
      mode: "mock"
    }
  });
});

test("buildStage1ConfigPatchFromFlatSettings maps llm.useMock=false to copilot", () => {
  const patch = buildStage1ConfigPatchFromFlatSettings({
    "llm.mode": "mock",
    "llm.useMock": false
  });

  assert.deepEqual(patch, {
    llm: {
      mode: "copilot"
    }
  });
});
