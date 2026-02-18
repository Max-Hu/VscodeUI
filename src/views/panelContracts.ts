import type { Stage1ReviewResult } from "../domain/types.js";

export interface StartReviewMessage {
  type: "start-review";
  payload: {
    prLink: string;
    reviewProfile?: "default" | "security" | "performance" | "compliance";
    additionalKeywords?: string[];
  };
}

export interface ReviewCompletedMessage {
  type: "review-completed";
  payload: Stage1ReviewResult;
}

export interface ReviewFailedMessage {
  type: "review-failed";
  payload: {
    message: string;
  };
}

export type PanelInboundMessage = StartReviewMessage;
export type PanelOutboundMessage = ReviewCompletedMessage | ReviewFailedMessage;
