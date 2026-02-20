import assert from "node:assert/strict";
import test from "node:test";
import { PanelReviewObserver, formatReviewEvent } from "../src/observability/panelReviewObserver.js";
import type { ReviewEvent } from "../src/observability/reviewObserver.js";

test("formatReviewEvent includes event details", () => {
  const event: ReviewEvent = {
    name: "step_succeeded",
    step: "fetch-github-context",
    durationMs: 123,
    timestamp: "2026-02-20T10:00:00.000Z"
  };

  const line = formatReviewEvent(event);

  assert.match(line, /\[2026-02-20T10:00:00.000Z\]/);
  assert.match(line, /step_succeeded/);
  assert.match(line, /step=fetch-github-context/);
  assert.match(line, /durationMs=123/);
});

test("PanelReviewObserver swallows logger and postMessage errors", async () => {
  const event: ReviewEvent = {
    name: "pipeline_started",
    timestamp: "2026-02-20T10:00:00.000Z"
  };

  const observer = new PanelReviewObserver({
    log: () => {
      throw new Error("logger unavailable");
    },
    onEvent: async () => {
      throw new Error("webview unavailable");
    }
  });

  await assert.doesNotReject(async () => observer.emit(event));
});
