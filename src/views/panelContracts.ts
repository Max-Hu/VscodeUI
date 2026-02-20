import type { Stage1ReviewResult } from "../domain/types.js";
import type { ReviewEvent } from "../observability/reviewObserver.js";

export interface StartReviewMessage {
  type: "start-review";
  payload: {
    prLink: string;
  };
}

export interface ReviewCompletedMessage {
  type: "review-completed";
  payload: Stage1ReviewResult;
}

export interface PublishReviewMessage {
  type: "publish-review";
  payload: {
    prLink: string;
    commentBody: string;
    confirmed: boolean;
  };
}

export interface PublishCompletedMessage {
  type: "publish-completed";
  payload: {
    commentUrl: string;
  };
}

export interface ReviewFailedMessage {
  type: "review-failed";
  payload: {
    message: string;
  };
}

export interface ReviewProgressMessage {
  type: "review-progress";
  payload: {
    event: ReviewEvent;
    text: string;
  };
}

export type PanelInboundMessage = StartReviewMessage | PublishReviewMessage;
export type PanelOutboundMessage = ReviewCompletedMessage | PublishCompletedMessage | ReviewFailedMessage | ReviewProgressMessage;
