import assert from "node:assert/strict";
import test from "node:test";
import { DemoConfluenceProvider, DemoGithubProvider, DemoJiraProvider } from "../src/providers/demo/demoProviders.js";
import { createPanelProviderSet } from "../src/providers/panelProviderFactory.js";
import { ConfluenceRestProvider } from "../src/providers/real/confluenceRestProvider.js";
import { GithubRestProvider } from "../src/providers/real/githubRestProvider.js";
import { JiraRestProvider } from "../src/providers/real/jiraRestProvider.js";

test("createPanelProviderSet returns demo providers when useDemoData is true", () => {
  const providers = createPanelProviderSet({ useDemoData: true, configPatch: {} });

  assert.equal(providers.source, "demo");
  assert.ok(providers.githubProvider instanceof DemoGithubProvider);
  assert.ok(providers.jiraProvider instanceof DemoJiraProvider);
  assert.ok(providers.confluenceProvider instanceof DemoConfluenceProvider);
});

test("createPanelProviderSet returns real providers when useDemoData is false", () => {
  const providers = createPanelProviderSet({
    useDemoData: false,
    disableTlsValidation: true,
    configPatch: {
      providers: {
        github: {
          domain: "https://alm-github.test/api/v3",
          credential: {}
        },
        jira: {
          domain: "https://alm-jira.test/jira",
          credential: {}
        },
        confluence: {
          domain: "https://alm-confluence.test/confluence",
          credential: {}
        }
      }
    }
  });

  assert.equal(providers.source, "real");
  assert.ok(providers.githubProvider instanceof GithubRestProvider);
  assert.ok(providers.jiraProvider instanceof JiraRestProvider);
  assert.ok(providers.confluenceProvider instanceof ConfluenceRestProvider);
});
