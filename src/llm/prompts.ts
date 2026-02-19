import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ConfluenceContext, GithubContext, JiraContext, ReviewContext, ReviewProfile, ScoreResult } from "../domain/types.js";
import { DRAFT_OUTPUT_SCHEMA, SCORE_OUTPUT_SCHEMA } from "./contracts.js";
import { renderPromptTemplate } from "./templateRenderer.js";

export interface ScorePromptInput {
  profile: ReviewProfile;
  githubContext: GithubContext;
  jiraContext: JiraContext;
  confluenceContext: ConfluenceContext;
}

export interface DraftPromptInput {
  reviewContext: ReviewContext;
  score: ScoreResult;
}

const TEMPLATE_CACHE = new Map<string, string>();
const HOT_RELOAD_ENV = "PR_REVIEWER_PROMPT_HOT_RELOAD";
const TEMPLATE_DIR_ENV = "PR_REVIEWER_PROMPT_TEMPLATE_DIR";

const FALLBACK_SCORE_TEMPLATE = [
  "You are a strict PR reviewer.",
  "Use only the supplied PR/Jira/Confluence context.",
  "Return JSON only. No markdown.",
  "JSON schema:",
  "{{output_schema}}",
  "Ensure all 7 dimensions are present exactly once in scoreBreakdown.",
  "Context:",
  "{{context_json}}"
].join("\n");

const FALLBACK_DRAFT_TEMPLATE = [
  "Generate a PR review markdown draft for human editing.",
  "Use concise sections: Summary, Score Breakdown, Jira/Confluence Traceability, Risks, Suggested Actions.",
  "Output JSON only: {{output_schema}}.",
  "Context:",
  "{{context_json}}"
].join("\n");

export function buildScorePrompt(input: ScorePromptInput): string {
  const fileSamples = input.githubContext.files.slice(0, 10).map((file) => ({
    path: file.path,
    patch: file.patch.slice(0, 1200),
    truncated: file.truncated
  }));

  const contextPayload = {
    profile: input.profile,
    pr: {
      title: input.githubContext.metadata.title,
      body: input.githubContext.metadata.body,
      url: input.githubContext.metadata.url,
      files: fileSamples,
      checks: input.githubContext.checks,
      commits: input.githubContext.commits
    },
    jira: {
      requestedKeys: input.jiraContext.requestedKeys,
      issues: input.jiraContext.issues
    },
    confluence: {
      pages: input.confluenceContext.pages.slice(0, 12).map((page) => ({
        title: page.title,
        url: page.url,
        relevanceScore: page.relevanceScore ?? 0,
        source: page.source,
        content: page.content.slice(0, 1200)
      }))
    }
  };

  const template = loadPromptTemplate("score", FALLBACK_SCORE_TEMPLATE);
  return renderPromptTemplate(template, {
    profile: input.profile,
    output_schema: SCORE_OUTPUT_SCHEMA,
    context_json: JSON.stringify(contextPayload)
  });
}

export function buildDraftPrompt(input: DraftPromptInput): string {
  const contextPayload = {
    pr: input.reviewContext.github.metadata.url,
    profile: input.reviewContext.profile,
    overallScore: input.score.overallScore,
    confidence: input.score.confidence,
    scoreBreakdown: input.score.scoreBreakdown,
    jira: input.reviewContext.jira.issues.map((issue) => ({ key: issue.key, summary: issue.summary })),
    confluence: input.reviewContext.confluence.pages.slice(0, 6).map((page) => ({
      title: page.title,
      url: page.url,
      relevanceScore: page.relevanceScore ?? 0
    })),
    traceability: input.reviewContext.traceability,
    evidence: input.score.evidence.slice(0, 8)
  };

  const template = loadPromptTemplate("draft", FALLBACK_DRAFT_TEMPLATE);
  return renderPromptTemplate(template, {
    profile: input.reviewContext.profile,
    output_schema: DRAFT_OUTPUT_SCHEMA,
    context_json: JSON.stringify(contextPayload)
  });
}

export function clearPromptTemplateCache(): void {
  TEMPLATE_CACHE.clear();
}

function loadPromptTemplate(name: "score" | "draft", fallback: string): string {
  const hotReload = isPromptHotReloadEnabled();
  const cached = TEMPLATE_CACHE.get(name);
  if (cached && !hotReload) {
    return cached;
  }

  const fileName = `${name}.md`;
  const candidates = resolveTemplateCandidates(fileName);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const loaded = readFileSync(candidate, "utf8");
      TEMPLATE_CACHE.set(name, loaded);
      return loaded;
    }
  }

  TEMPLATE_CACHE.set(name, fallback);
  return fallback;
}

function isPromptHotReloadEnabled(): boolean {
  const raw = process.env[HOT_RELOAD_ENV];
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function resolveTemplateCandidates(fileName: string): string[] {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, "templates", fileName),
    path.resolve(process.cwd(), "src", "llm", "templates", fileName),
    path.resolve(process.cwd(), "dist", "src", "llm", "templates", fileName)
  ];

  const customTemplateDir = process.env[TEMPLATE_DIR_ENV];
  if (customTemplateDir && customTemplateDir.trim()) {
    candidates.unshift(path.resolve(customTemplateDir.trim(), fileName));
  }

  return candidates;
}
