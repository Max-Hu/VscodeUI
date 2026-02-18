import assert from "node:assert/strict";
import test from "node:test";
import { Stage1ReviewOrchestrator } from "../src/orchestrator/reviewOrchestrator.js";
import { MockGithubProvider } from "../src/providers/mocks/mockGithubProvider.js";
import { MockJiraProvider } from "../src/providers/mocks/mockJiraProvider.js";
import { fixtureIssues, fixturePullRequest } from "./fixtures.js";
test("Stage1ReviewOrchestrator runs PR -> Jira -> Score -> Draft pipeline", async () => {
    const githubProvider = new MockGithubProvider({
        "acme/platform#42": fixturePullRequest
    });
    const jiraProvider = new MockJiraProvider(fixtureIssues);
    const orchestrator = new Stage1ReviewOrchestrator({
        githubProvider,
        jiraProvider
    });
    const result = await orchestrator.run({
        prLink: "https://github.com/acme/platform/pull/42",
        reviewProfile: "default"
    });
    assert.equal(result.context.prReference.owner, "acme");
    assert.equal(result.context.jira.issues.length, 2);
    assert.ok(result.score.overallScore > 0);
    assert.match(result.draft.markdown, /PR Review Draft/);
    assert.match(result.draft.markdown, /PROJ-123/);
});
