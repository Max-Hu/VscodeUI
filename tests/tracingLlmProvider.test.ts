import assert from "node:assert/strict";
import test from "node:test";
import { TracingLlmProvider } from "../src/llm/tracingLlmProvider.js";

test("TracingLlmProvider emits prompt and response traces", async () => {
  const events: string[] = [];
  const traced = new TracingLlmProvider(
    {
      describe() {
        return "provider=test";
      },
      async generate() {
        return "{\"ok\":true}";
      }
    },
    {
      maxPreviewChars: 20,
      onPrompt: ({ operation, promptPreview }) => {
        events.push(`prompt:${operation}:${promptPreview.length}`);
      },
      onResponse: ({ operation, outputPreview, durationMs }) => {
        events.push(`response:${operation}:${outputPreview.length}:${durationMs >= 0}`);
      }
    }
  );

  const output = await traced.generate('{"overallScore":1,"scoreBreakdown":[],"confidence":"low"}');

  assert.equal(output, '{"ok":true}');
  assert.equal(events.length, 2);
  assert.match(events[0], /^prompt:score-pr:/);
  assert.match(events[1], /^response:score-pr:/);
});

test("TracingLlmProvider emits error trace and rethrows", async () => {
  const events: string[] = [];
  const traced = new TracingLlmProvider(
    {
      async generate() {
        throw new Error("llm down");
      }
    },
    {
      onError: ({ operation, errorMessage, durationMs }) => {
        events.push(`${operation}:${errorMessage}:${durationMs >= 0}`);
      }
    }
  );

  await assert.rejects(() => traced.generate('Output JSON: {"markdown": "..."}; Generate a PR review markdown draft'));
  assert.equal(events.length, 1);
  assert.match(events[0], /^draft-comment:llm down:true$/);
});
