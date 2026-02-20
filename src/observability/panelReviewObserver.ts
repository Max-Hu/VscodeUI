import type { IReviewObserver, ReviewEvent } from "./reviewObserver.js";

export interface PanelReviewObserverDeps {
  log?: (line: string) => void;
  onEvent?: (event: ReviewEvent, formatted: string) => void | Promise<void>;
}

export class PanelReviewObserver implements IReviewObserver {
  constructor(private readonly deps: PanelReviewObserverDeps) {}

  async emit(event: ReviewEvent): Promise<void> {
    const formatted = formatReviewEvent(event);

    try {
      this.deps.log?.(formatted);
    } catch {
      // avoid interrupting review flow on logger failures
    }

    try {
      await this.deps.onEvent?.(event, formatted);
    } catch {
      // avoid interrupting review flow on webview push failures
    }
  }
}

export function formatReviewEvent(event: ReviewEvent): string {
  const parts: string[] = [event.name];
  if (event.step) {
    parts.push(`step=${event.step}`);
  }
  if (typeof event.durationMs === "number") {
    parts.push(`durationMs=${event.durationMs}`);
  }
  if (event.message) {
    parts.push(`message=${event.message}`);
  }
  return `[${event.timestamp}] ${parts.join(" | ")}`;
}
