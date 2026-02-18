import assert from "node:assert/strict";
import test from "node:test";
import { defaultStage1Config } from "../src/config/defaults.js";
import { ExtractJiraKeysSkill } from "../src/skills/extractJiraKeysSkill.js";
const context = {
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
test("ExtractJiraKeysSkill returns deduplicated sorted keys", async () => {
    const skill = new ExtractJiraKeysSkill();
    const result = await skill.run({
        githubContext: {
            metadata: {
                title: "",
                body: "",
                author: "",
                baseBranch: "",
                headBranch: "",
                url: ""
            },
            files: [],
            commits: [
                { sha: "1", message: "PROJ-2 fix A" },
                { sha: "2", message: "proj-2 duplicate lower should not match default regex" },
                { sha: "3", message: "PROJ-1 add B" }
            ],
            checks: [],
            comments: [],
            signals: { confluenceLinks: [], keywords: [] }
        }
    }, context);
    assert.deepEqual(result.jiraKeys, ["PROJ-1", "PROJ-2"]);
});
