import type { DraftComment, ReviewContext, ScoreResult } from "../domain/types.js";
import type { SkillContext } from "./context.js";
import type { Skill } from "./skill.js";

export interface DraftCommentInput {
  reviewContext: ReviewContext;
  score: ScoreResult;
}

export interface DraftCommentOutput {
  draft: DraftComment;
}

export class DraftCommentSkill implements Skill<DraftCommentInput, DraftCommentOutput, SkillContext> {
  id = "draft-comment";
  description = "Generate a structured markdown draft for manual review and editing.";

  async run(input: DraftCommentInput, _context: SkillContext): Promise<DraftCommentOutput> {
    const { reviewContext, score } = input;
    const lowScores = score.scoreBreakdown.filter((item) => item.score < 60);
    const jiraLines =
      reviewContext.jira.issues.length > 0
        ? reviewContext.jira.issues.map((issue) => `- ${issue.key}: ${issue.summary}`).join("\n")
        : "- No Jira issue details were found for extracted keys.";

    const scoreTable = score.scoreBreakdown
      .map((item) => `| ${item.dimension} | ${item.score} | ${item.weight} | ${item.rationale} |`)
      .join("\n");

    const evidenceLines = score.evidence
      .slice(0, 5)
      .map((item) => `- ${item.file ?? "context"}: ${(item.snippet ?? "").replace(/\n+/g, " ").slice(0, 180)}`)
      .join("\n");

    const markdown = [
      `## PR Review Draft`,
      ``,
      `- PR: ${reviewContext.github.metadata.url}`,
      `- Profile: ${reviewContext.profile}`,
      `- Overall Score: **${score.overallScore}/100**`,
      `- Confidence: **${score.confidence}**`,
      ``,
      `### Score Breakdown`,
      `| Dimension | Score | Weight | Rationale |`,
      `| --- | ---: | ---: | --- |`,
      scoreTable,
      ``,
      `### Jira Traceability`,
      jiraLines,
      ``,
      `### Evidence`,
      evidenceLines || "- No evidence captured.",
      ``,
      `### Risks`,
      lowScores.length > 0
        ? lowScores.map((item) => `- ${item.dimension} is below threshold (${item.score}).`).join("\n")
        : "- No critical dimension below threshold.",
      ``,
      `### Suggested Action`,
      `- Please review findings and edit this draft before publishing.`
    ].join("\n");

    return {
      draft: {
        markdown
      }
    };
  }
}
