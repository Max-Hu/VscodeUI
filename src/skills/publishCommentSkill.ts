import type { PublishCommentResult, PrReference } from "../domain/types.js";
import type { SkillContext } from "./context.js";
import type { Skill } from "./skill.js";

export interface PublishCommentInput {
  prReference: PrReference;
  commentBody: string;
  confirmed: boolean;
}

export interface PublishCommentOutput {
  result: PublishCommentResult;
}

export class PublishCommentSkill
  implements Skill<PublishCommentInput, PublishCommentOutput, SkillContext>
{
  id = "publish-comment";
  description = "Publish edited PR comment with confirmation gate.";

  async run(input: PublishCommentInput, context: SkillContext): Promise<PublishCommentOutput> {
    if (!context.config.post.enabled) {
      throw new Error("Publishing is disabled by configuration.");
    }
    if (context.config.post.requireConfirmation && !input.confirmed) {
      throw new Error("Publishing requires explicit confirmation.");
    }
    if (!input.commentBody.trim()) {
      throw new Error("Edited comment body cannot be empty.");
    }

    const comment = await context.providers.github.publishReviewComment(input.prReference, input.commentBody);
    return {
      result: {
        published: true,
        usedEditedBody: true,
        comment
      }
    };
  }
}
