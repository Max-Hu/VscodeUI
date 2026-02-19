import type {
  ConfluenceContext,
  GithubContext,
  JiraContext,
  ReviewProfile,
  ScoreBreakdownItem,
  ScoreDimension,
  ScoreResult
} from "../domain/types.js";
import { buildScorePrompt } from "../llm/prompts.js";
import { parseJsonFromLlm } from "../utils/llmJson.js";
import type { SkillContext } from "./context.js";
import type { Skill } from "./skill.js";

export interface ScorePrInput {
  githubContext: GithubContext;
  jiraContext: JiraContext;
  confluenceContext: ConfluenceContext;
  profile: ReviewProfile;
}

export interface ScorePrOutput {
  score: ScoreResult;
}

interface LlmScorePayload {
  overallScore: number;
  scoreBreakdown: Array<{
    dimension: ScoreDimension;
    score: number;
    weight?: number;
    rationale: string;
  }>;
  evidence?: Array<{
    file?: string;
    snippet?: string;
  }>;
  confidence: "low" | "medium" | "high";
}

const VALID_DIMENSIONS: ScoreDimension[] = [
  "Correctness",
  "Maintainability",
  "Reliability",
  "Security",
  "Performance",
  "Test Quality",
  "Traceability"
];

export class ScorePrSkill implements Skill<ScorePrInput, ScorePrOutput, SkillContext> {
  id = "score-pr";
  description = "Generate score and rationale using LLM only.";

  async run(input: ScorePrInput, context: SkillContext): Promise<ScorePrOutput> {
    if (!context.llm) {
      throw new Error("LLM provider is required for score-pr. Configure Copilot provider.");
    }

    const prompt = buildScorePrompt({
      profile: input.profile,
      githubContext: input.githubContext,
      jiraContext: input.jiraContext,
      confluenceContext: input.confluenceContext
    });
    const raw = await context.llm.generate(prompt);
    const payload = parseJsonFromLlm<LlmScorePayload>(raw);
    const score = validateAndNormalize(payload, context.config.scoring.weights);
    return { score };
  }
}

function validateAndNormalize(
  payload: LlmScorePayload,
  defaultWeights: Record<ScoreDimension, number>
): ScoreResult {
  if (typeof payload.overallScore !== "number" || payload.overallScore < 0 || payload.overallScore > 100) {
    throw new Error("Invalid LLM score: overallScore must be a number in [0,100].");
  }
  if (!Array.isArray(payload.scoreBreakdown) || payload.scoreBreakdown.length === 0) {
    throw new Error("Invalid LLM score: scoreBreakdown is required.");
  }
  if (!["low", "medium", "high"].includes(payload.confidence)) {
    throw new Error("Invalid LLM score: confidence must be low/medium/high.");
  }

  const seen = new Set<string>();
  const scoreBreakdown: ScoreBreakdownItem[] = payload.scoreBreakdown.map((item) => {
    if (!VALID_DIMENSIONS.includes(item.dimension)) {
      throw new Error(`Invalid LLM score dimension: ${String(item.dimension)}`);
    }
    if (seen.has(item.dimension)) {
      throw new Error(`Duplicated LLM score dimension: ${item.dimension}`);
    }
    seen.add(item.dimension);
    if (typeof item.score !== "number" || item.score < 0 || item.score > 100) {
      throw new Error(`Invalid LLM score value for ${item.dimension}`);
    }
    if (typeof item.rationale !== "string" || !item.rationale.trim()) {
      throw new Error(`Invalid LLM rationale for ${item.dimension}`);
    }
    return {
      dimension: item.dimension,
      score: Math.round(item.score),
      weight: typeof item.weight === "number" ? item.weight : defaultWeights[item.dimension],
      rationale: item.rationale.trim()
    };
  });

  if (seen.size !== VALID_DIMENSIONS.length) {
    throw new Error("Invalid LLM score: all 7 dimensions must be present.");
  }

  return {
    overallScore: Math.round(payload.overallScore),
    scoreBreakdown,
    evidence: Array.isArray(payload.evidence)
      ? payload.evidence.map((item) => ({
          ...(typeof item.file === "string" ? { file: item.file } : {}),
          ...(typeof item.snippet === "string" ? { snippet: item.snippet } : {})
        }))
      : [],
    confidence: payload.confidence
  };
}
