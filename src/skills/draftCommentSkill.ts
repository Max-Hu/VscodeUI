import type { DraftComment, ReviewContext, ScoreResult } from "../domain/types.js";
import { buildDraftPrompt } from "../llm/prompts.js";
import { parseJsonFromLlm } from "../utils/llmJson.js";
import type { SkillContext } from "./context.js";
import type { Skill } from "./skill.js";

export interface DraftCommentInput {
  reviewContext: ReviewContext;
  score: ScoreResult;
}

export interface DraftCommentOutput {
  draft: DraftComment;
  usedLlm: boolean;
}

interface LlmDraftPayload {
  markdown: string;
}

export class DraftCommentSkill implements Skill<DraftCommentInput, DraftCommentOutput, SkillContext> {
  id = "draft-comment";
  description = "Generate markdown draft using LLM only.";

  async run(input: DraftCommentInput, context: SkillContext): Promise<DraftCommentOutput> {
    if (!context.llm) {
      throw new Error("LLM provider is required for draft-comment. Configure prReviewer.config.llm settings.");
    }

    const prompt = buildDraftPrompt({
      reviewContext: input.reviewContext,
      score: input.score
    });
    const raw = await context.llm.generate(prompt);
    const markdown = parseMarkdown(raw);
    return {
      draft: {
        markdown
      },
      usedLlm: true
    };
  }
}

function parseMarkdown(raw: string): string {
  try {
    const parsed = parseJsonFromLlm<LlmDraftPayload>(raw);
    if (typeof parsed.markdown === "string" && parsed.markdown.trim()) {
      return parsed.markdown.trim();
    }
  } catch {
    // fall through to markdown parsing
  }

  const trimmed = raw.trim();
  if (trimmed && (/^#\s+/m.test(trimmed) || /^##\s+/m.test(trimmed))) {
    return trimmed;
  }

  throw new Error("LLM draft output is invalid. Expected JSON {markdown} or markdown text.");
}
