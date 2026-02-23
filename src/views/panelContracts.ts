import type { Stage1ReviewResult } from "../domain/types.js";
import type { ReviewEvent } from "../observability/reviewObserver.js";

export interface StartReviewMessage {
  type: "start-review";
  payload: {
    prLink: string;
    copilotModelId?: string;
  };
}

export interface ListCopilotModelsMessage {
  type: "list-copilot-models";
  payload?: Record<string, never>;
}

export interface CopilotModelOption {
  id: string;
  label: string;
  name?: string;
  family?: string;
  version?: string;
  reasoningEffort?: string;
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

export interface CopilotModelsMessage {
  type: "copilot-models";
  payload: {
    models: CopilotModelOption[];
    error?: string;
  };
}

export type PanelInboundMessage = StartReviewMessage | PublishReviewMessage | ListCopilotModelsMessage;
export type PanelOutboundMessage =
  | ReviewCompletedMessage
  | PublishCompletedMessage
  | ReviewFailedMessage
  | ReviewProgressMessage
  | CopilotModelsMessage;
