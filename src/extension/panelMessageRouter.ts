import type {
  PublishCommentRequest,
  PublishCommentResult,
  ReviewProfile,
  ReviewRequest,
  Stage3ReviewResult
} from "../domain/types.js";
import type { PanelInboundMessage, PanelOutboundMessage } from "../views/panelContracts.js";

const REVIEW_PROFILES: ReviewProfile[] = ["default", "security", "performance", "compliance"];

export interface PanelMessageRouterDeps {
  runReview(request: ReviewRequest): Promise<Stage3ReviewResult>;
  publishEditedComment(request: PublishCommentRequest): Promise<PublishCommentResult>;
}

export async function routePanelMessage(
  message: unknown,
  deps: PanelMessageRouterDeps
): Promise<PanelOutboundMessage> {
  try {
    if (!isPanelInboundMessage(message)) {
      throw new Error("Unsupported panel message type.");
    }

    if (message.type === "start-review") {
      const request = toReviewRequest(message);
      const result = await deps.runReview(request);
      return {
        type: "review-completed",
        payload: result
      };
    }

    const publishRequest = toPublishRequest(message);
    const publishResult = await deps.publishEditedComment(publishRequest);
    return {
      type: "publish-completed",
      payload: {
        commentUrl: publishResult.comment.url
      }
    };
  } catch (error) {
    return {
      type: "review-failed",
      payload: {
        message: getErrorMessage(error)
      }
    };
  }
}

function toReviewRequest(message: Extract<PanelInboundMessage, { type: "start-review" }>): ReviewRequest {
  const prLink = asNonEmptyString(message.payload?.prLink);
  if (!prLink) {
    throw new Error("PR link is required.");
  }

  const reviewProfile = asReviewProfile(message.payload?.reviewProfile);
  const additionalKeywords = asKeywords(message.payload?.additionalKeywords);

  return {
    prLink,
    ...(reviewProfile ? { reviewProfile } : {}),
    ...(additionalKeywords ? { additionalKeywords } : {})
  };
}

function toPublishRequest(message: Extract<PanelInboundMessage, { type: "publish-review" }>): PublishCommentRequest {
  const prLink = asNonEmptyString(message.payload?.prLink);
  if (!prLink) {
    throw new Error("PR link is required for publishing.");
  }

  const commentBody = asNonEmptyString(message.payload?.commentBody);
  if (!commentBody) {
    throw new Error("Comment body is required for publishing.");
  }

  return {
    prLink,
    commentBody,
    confirmed: Boolean(message.payload?.confirmed)
  };
}

function asReviewProfile(value: unknown): ReviewProfile | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return REVIEW_PROFILES.includes(value as ReviewProfile) ? (value as ReviewProfile) : undefined;
}

function asKeywords(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const keywords = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return keywords.length ? keywords : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Request failed.";
}

function isPanelInboundMessage(value: unknown): value is PanelInboundMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const maybeMessage = value as { type?: unknown };
  return maybeMessage.type === "start-review" || maybeMessage.type === "publish-review";
}
