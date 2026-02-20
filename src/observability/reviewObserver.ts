export type ReviewEventName =
  | "pipeline_started"
  | "pipeline_completed"
  | "pipeline_failed"
  | "step_started"
  | "step_succeeded"
  | "step_failed"
  | "degraded"
  | "llm_prompt"
  | "llm_response"
  | "llm_error";

export interface ReviewEvent {
  name: ReviewEventName;
  step?: string;
  message?: string;
  durationMs?: number;
  timestamp: string;
}

export interface IReviewObserver {
  emit(event: ReviewEvent): void | Promise<void>;
}

export class NoopReviewObserver implements IReviewObserver {
  emit(_event: ReviewEvent): void {}
}

export class InMemoryReviewObserver implements IReviewObserver {
  private readonly events: ReviewEvent[] = [];

  emit(event: ReviewEvent): void {
    this.events.push(event);
  }

  getEvents(): ReviewEvent[] {
    return [...this.events];
  }
}
