import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { ConfluenceRestProvider } from "../src/providers/real/confluenceRestProvider.js";
import { GithubRestProvider } from "../src/providers/real/githubRestProvider.js";
import { JiraRestProvider } from "../src/providers/real/jiraRestProvider.js";

interface RecordedRequest {
  method: string;
  pathname: string;
  search: string;
  authorization?: string;
}

test("GithubRestProvider requests endpoints under /api/v3 and uses bearer token", async () => {
  const recorded: RecordedRequest[] = [];
  const { baseUrl, close } = await startJsonServer((requestUrl, req, res) => {
    recorded.push({
      method: req.method ?? "GET",
      pathname: requestUrl.pathname,
      search: requestUrl.search,
      authorization: req.headers.authorization
    });

    if (requestUrl.pathname === "/api/v3/repos/acme/platform/pulls/42") {
      return sendJson(res, {
        title: "PR 42",
        body: "",
        user: { login: "alice" },
        html_url: "https://alm-github.test/acme/platform/pull/42"
      });
    }
    if (
      requestUrl.pathname === "/api/v3/repos/acme/platform/pulls/42/files" ||
      requestUrl.pathname === "/api/v3/repos/acme/platform/pulls/42/commits" ||
      requestUrl.pathname === "/api/v3/repos/acme/platform/issues/42/comments"
    ) {
      return sendJson(res, []);
    }
    res.statusCode = 404;
    res.end();
  });

  try {
    const provider = new GithubRestProvider({
      domain: `${baseUrl}/api/v3`,
      credential: {
        tokenRef: "gh_token"
      }
    });

    await provider.getPullRequest({
      owner: "acme",
      repo: "platform",
      prNumber: 42
    });

    assert.ok(recorded.some((r) => r.pathname === "/api/v3/repos/acme/platform/pulls/42"));
    assert.ok(recorded.some((r) => r.pathname === "/api/v3/repos/acme/platform/pulls/42/files"));
    assert.ok(recorded.some((r) => r.pathname === "/api/v3/repos/acme/platform/pulls/42/commits"));
    assert.ok(recorded.some((r) => r.pathname === "/api/v3/repos/acme/platform/issues/42/comments"));
    assert.ok(recorded.every((r) => r.authorization === "Bearer gh_token"));
  } finally {
    await close();
  }
});

test("JiraRestProvider requests endpoints under /jira/rest/api/2 and uses bearer token", async () => {
  const recorded: RecordedRequest[] = [];
  const { baseUrl, close } = await startJsonServer((requestUrl, req, res) => {
    recorded.push({
      method: req.method ?? "GET",
      pathname: requestUrl.pathname,
      search: requestUrl.search,
      authorization: req.headers.authorization
    });

    if (requestUrl.pathname === "/jira/rest/api/2/issue/CDPS-999") {
      return sendJson(res, {
        key: "CDPS-999",
        fields: {
          summary: "Test issue",
          description: "",
          parent: null,
          subtasks: [],
          issuelinks: []
        }
      });
    }
    if (requestUrl.pathname === "/jira/rest/api/2/issue/CDPS-999/remotelink") {
      return sendJson(res, []);
    }
    res.statusCode = 404;
    res.end();
  });

  try {
    const provider = new JiraRestProvider({
      domain: `${baseUrl}/jira`,
      credential: {
        token: "jira_token"
      }
    });

    const result = await provider.getIssues(["CDPS-999"], { expandDepth: 0 });
    assert.equal(result.length, 1);
    assert.ok(recorded.some((r) => r.pathname === "/jira/rest/api/2/issue/CDPS-999"));
    assert.ok(recorded.some((r) => r.pathname === "/jira/rest/api/2/issue/CDPS-999/remotelink"));
    assert.ok(recorded.every((r) => r.authorization === "Bearer jira_token"));
  } finally {
    await close();
  }
});

test("ConfluenceRestProvider requests endpoints under /confluence/rest/api and supports content-id API URLs", async () => {
  const recorded: RecordedRequest[] = [];
  let dynamicBase = "";
  const { baseUrl, close } = await startJsonServer((requestUrl, req, res) => {
    recorded.push({
      method: req.method ?? "GET",
      pathname: requestUrl.pathname,
      search: requestUrl.search,
      authorization: req.headers.authorization
    });

    if (requestUrl.pathname === "/confluence/rest/api/content/22222") {
      return sendJson(res, {
        id: "22222",
        title: "Confluence Page",
        body: {
          storage: {
            value: "<p>Hello</p>"
          }
        }
      });
    }
    if (requestUrl.pathname === "/confluence/rest/api/content/search") {
      return sendJson(res, {
        results: [
          {
            id: "22222",
            title: "Confluence Page",
            body: { storage: { value: "<p>Hello</p>" } },
            _links: {
              base: `${dynamicBase}/confluence`,
              webui: "/pages/viewpage.action?pageId=22222"
            }
          }
        ]
      });
    }
    res.statusCode = 404;
    res.end();
  });

  dynamicBase = baseUrl;

  try {
    const provider = new ConfluenceRestProvider({
      domain: `${baseUrl}/confluence`,
      credential: {
        token: "confluence_token"
      }
    });

    const byUrl = await provider.getPagesByUrls([`${baseUrl}/confluence/rest/api/content/22222`], { expandDepth: 0 });
    const bySearch = await provider.searchPages("CDPS-999", { topK: 5, expandDepth: 0 });

    assert.equal(byUrl.length, 1);
    assert.equal(bySearch.length, 1);
    assert.ok(recorded.some((r) => r.pathname === "/confluence/rest/api/content/22222"));
    assert.ok(recorded.some((r) => r.pathname === "/confluence/rest/api/content/search"));
    assert.ok(recorded.every((r) => r.authorization === "Bearer confluence_token"));
  } finally {
    await close();
  }
});

async function startJsonServer(
  handler: (url: URL, req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    handler(url, req, res);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
}

function sendJson(res: http.ServerResponse, body: unknown): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
