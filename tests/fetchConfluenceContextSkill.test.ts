import assert from "node:assert/strict";
import test from "node:test";
import { defaultStage1Config } from "../src/config/defaults.js";
import { MockConfluenceProvider } from "../src/providers/mocks/mockConfluenceProvider.js";
import { FetchConfluenceContextSkill } from "../src/skills/fetchConfluenceContextSkill.js";
import type { SkillContext } from "../src/skills/context.js";

test("FetchConfluenceContextSkill prefers strong links and performs query expansion", async () => {
  const provider = new MockConfluenceProvider({
    byUrl: {
      "https://example.atlassian.net/wiki/spaces/ENG/pages/101": {
        id: "101",
        title: "PROJ-123 Design",
        url: "https://example.atlassian.net/wiki/spaces/ENG/pages/101",
        content: "API and rollback plan"
      }
    },
    byQuery: {
      "proj-123": [
        {
          id: "101",
          title: "PROJ-123 Design",
          url: "https://example.atlassian.net/wiki/spaces/ENG/pages/101",
          content: "duplicate from query"
        }
      ],
      retry: [
        {
          id: "205",
          title: "Retry Runbook",
          url: "https://example.atlassian.net/wiki/spaces/SRE/pages/205",
          content: "monitoring and incident response"
        }
      ]
    }
  });

  const context: SkillContext = {
    config: {
      ...defaultStage1Config,
      topK: 10,
      providers: {
        ...defaultStage1Config.providers,
        confluence: {
          ...defaultStage1Config.providers.confluence,
          enableExpandedSearch: true
        }
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
      confluence: provider
    }
  };

  const skill = new FetchConfluenceContextSkill();
  const result = await skill.run(
    {
      githubContext: {
        metadata: {
          title: "PROJ-123",
          body: "Design link: https://example.atlassian.net/wiki/spaces/ENG/pages/101",
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
          confluenceLinks: ["https://example.atlassian.net/wiki/spaces/ENG/pages/101"],
          keywords: ["retry"]
        }
      },
      jiraContext: {
        requestedKeys: ["PROJ-123"],
        issues: [
          {
            key: "PROJ-123",
            summary: "Add retry",
            description: "",
            acceptanceCriteria: ["retries max 3"],
            nfr: [],
            risks: [],
            testingRequirements: [],
            links: ["https://example.atlassian.net/wiki/spaces/ENG/pages/101"]
          }
        ]
      }
    },
    context
  );

  assert.equal(result.confluence.strongLinkedUrls.length, 1);
  assert.ok(result.confluence.searchQueries.includes("PROJ-123"));
  assert.ok(result.confluence.pages.some((page) => page.source === "issue-link"));
  assert.ok(result.confluence.pages.some((page) => page.source === "keyword-query"));
  assert.equal(
    result.confluence.pages.filter((page) => page.url === "https://example.atlassian.net/wiki/spaces/ENG/pages/101")
      .length,
    1
  );
});

test("FetchConfluenceContextSkill ignores non-confluence Jira links for direct page fetch", async () => {
  const capturedUrls: string[][] = [];
  const context: SkillContext = {
    config: {
      ...defaultStage1Config,
      providers: {
        ...defaultStage1Config.providers,
        confluence: {
          ...defaultStage1Config.providers.confluence,
          domain: "https://example.atlassian.net/wiki"
        }
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
        async getPagesByUrls(urls: string[]) {
          capturedUrls.push(urls);
          return [];
        },
        async searchPages() {
          return [];
        }
      }
    }
  };

  const skill = new FetchConfluenceContextSkill();
  await skill.run(
    {
      githubContext: {
        metadata: {
          title: "PROJ-999",
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
          keywords: []
        }
      },
      jiraContext: {
        requestedKeys: ["PROJ-999"],
        issues: [
          {
            key: "PROJ-999",
            summary: "Mixed links",
            description: "",
            acceptanceCriteria: [],
            nfr: [],
            risks: [],
            testingRequirements: [],
            links: [
              "https://example.atlassian.net/wiki/spaces/ENG/pages/101",
              "https://docs.example.com/runbook/incident",
              "https://github.com/acme/platform/issues/123"
            ]
          }
        ]
      }
    },
    context
  );

  assert.equal(capturedUrls.length, 1);
  assert.deepEqual(capturedUrls[0], ["https://example.atlassian.net/wiki/spaces/ENG/pages/101"]);
});

test("FetchConfluenceContextSkill accepts confluence-like paths on custom hosts without domain match", async () => {
  const capturedUrls: string[][] = [];
  const context: SkillContext = {
    config: {
      ...defaultStage1Config,
      providers: {
        ...defaultStage1Config.providers,
        confluence: {
          ...defaultStage1Config.providers.confluence,
          domain: "https://some-other-domain.internal/wiki"
        }
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
        async getPagesByUrls(urls: string[]) {
          capturedUrls.push(urls);
          return [];
        },
        async searchPages() {
          return [];
        }
      }
    }
  };

  const skill = new FetchConfluenceContextSkill();
  await skill.run(
    {
      githubContext: {
        metadata: {
          title: "PROJ-100",
          body: "",
          author: "alice",
          baseBranch: "main",
          headBranch: "feature",
          url: "https://git.example.internal/acme/platform/pull/42"
        },
        files: [],
        commits: [],
        checks: [],
        comments: [],
        signals: {
          confluenceLinks: ["https://docs.internal.local/wiki/spaces/ENG/pages/101"],
          keywords: []
        }
      },
      jiraContext: {
        requestedKeys: ["PROJ-100"],
        issues: [
          {
            key: "PROJ-100",
            summary: "Custom domain docs",
            description: "",
            acceptanceCriteria: [],
            nfr: [],
            risks: [],
            testingRequirements: [],
            links: ["https://docs.internal.local/pages/viewpage.action?pageId=12345"]
          }
        ]
      }
    },
    context
  );

  assert.equal(capturedUrls.length, 1);
  assert.deepEqual(capturedUrls[0], [
    "https://docs.internal.local/pages/viewpage.action?pageId=12345",
    "https://docs.internal.local/wiki/spaces/ENG/pages/101"
  ]);
});

test("FetchConfluenceContextSkill disables expanded query search by default and only fetches links with page IDs", async () => {
  const capturedUrls: string[][] = [];
  let searchCallCount = 0;
  const context: SkillContext = {
    config: {
      ...defaultStage1Config
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
        async getPagesByUrls(urls: string[]) {
          capturedUrls.push(urls);
          return [];
        },
        async searchPages() {
          searchCallCount += 1;
          return [];
        }
      }
    }
  };

  const skill = new FetchConfluenceContextSkill();
  const result = await skill.run(
    {
      githubContext: {
        metadata: {
          title: "CDPS-999",
          body: "",
          author: "alice",
          baseBranch: "main",
          headBranch: "feature",
          url: "https://alm-github.test/acme/platform/pull/42"
        },
        files: [],
        commits: [],
        checks: [],
        comments: [],
        signals: {
          confluenceLinks: [
            "https://alm-confluence.test/confluence/display/ENG/Runbook",
            "https://alm-confluence.test/confluence/rest/api/content/22222"
          ],
          keywords: ["retry"]
        }
      },
      jiraContext: {
        requestedKeys: ["CDPS-999"],
        issues: [
          {
            key: "CDPS-999",
            summary: "Issue summary",
            description: "",
            acceptanceCriteria: ["retry"],
            nfr: [],
            risks: [],
            testingRequirements: [],
            links: ["https://alm-confluence.test/confluence/pages/viewpage.action?pageId=33333"]
          }
        ]
      }
    },
    context
  );

  assert.equal(searchCallCount, 0);
  assert.deepEqual(result.confluence.searchQueries, []);
  assert.equal(capturedUrls.length, 1);
  assert.deepEqual(capturedUrls[0], [
    "https://alm-confluence.test/confluence/pages/viewpage.action?pageId=33333",
    "https://alm-confluence.test/confluence/rest/api/content/22222"
  ]);
});
