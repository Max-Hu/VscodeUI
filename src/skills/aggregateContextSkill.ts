import type { GithubContext, JiraContext, PrReference, ReviewContext, ReviewProfile } from "../domain/types.js";
import type { SkillContext } from "./context.js";
import type { Skill } from "./skill.js";

export interface AggregateContextInput {
  prReference: PrReference;
  profile: ReviewProfile;
  githubContext: GithubContext;
  jiraContext: JiraContext;
}

export interface AggregateContextOutput {
  reviewContext: ReviewContext;
}

export class AggregateContextSkill
  implements Skill<AggregateContextInput, AggregateContextOutput, SkillContext>
{
  id = "aggregate-context";
  description = "Build the normalized review context for downstream scoring and drafting.";

  async run(input: AggregateContextInput, _context: SkillContext): Promise<AggregateContextOutput> {
    return {
      reviewContext: {
        prReference: input.prReference,
        profile: input.profile,
        github: input.githubContext,
        jira: input.jiraContext
      }
    };
  }
}
