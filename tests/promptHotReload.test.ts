import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildScorePrompt, clearPromptTemplateCache } from "../src/llm/prompts.js";

const HOT_RELOAD_ENV = "PR_REVIEWER_PROMPT_HOT_RELOAD";
const TEMPLATE_DIR_ENV = "PR_REVIEWER_PROMPT_TEMPLATE_DIR";

test("prompt templates hot reload when file content changes", () => {
  const previousHotReload = process.env[HOT_RELOAD_ENV];
  const previousTemplateDir = process.env[TEMPLATE_DIR_ENV];

  const tempDir = mkdtempSync(path.join(tmpdir(), "pr-reviewer-prompt-"));
  const scoreTemplatePath = path.join(tempDir, "score.md");

  try {
    process.env[HOT_RELOAD_ENV] = "true";
    process.env[TEMPLATE_DIR_ENV] = tempDir;
    clearPromptTemplateCache();

    writeFileSync(
      scoreTemplatePath,
      "VERSION_1 profile={{profile}}\nschema={{output_schema}}\nctx={{context_json}}",
      "utf8"
    );
    const first = buildScorePrompt(minimalInput());
    assert.match(first, /VERSION_1/);

    writeFileSync(
      scoreTemplatePath,
      "VERSION_2 profile={{profile}}\nschema={{output_schema}}\nctx={{context_json}}",
      "utf8"
    );
    const second = buildScorePrompt(minimalInput());
    assert.match(second, /VERSION_2/);
  } finally {
    clearPromptTemplateCache();
    if (previousHotReload === undefined) {
      delete process.env[HOT_RELOAD_ENV];
    } else {
      process.env[HOT_RELOAD_ENV] = previousHotReload;
    }
    if (previousTemplateDir === undefined) {
      delete process.env[TEMPLATE_DIR_ENV];
    } else {
      process.env[TEMPLATE_DIR_ENV] = previousTemplateDir;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function minimalInput() {
  return {
    profile: "default" as const,
    githubContext: {
      metadata: {
        title: "PROJ-1",
        body: "body",
        author: "alice",
        baseBranch: "main",
        headBranch: "feature",
        url: "https://github.com/acme/platform/pull/1"
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
      requestedKeys: ["PROJ-1"],
      issues: []
    },
    confluenceContext: {
      strongLinkedUrls: [],
      searchQueries: [],
      pages: []
    }
  };
}
