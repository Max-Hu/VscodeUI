import type { ILlmProvider } from "./llmProvider.js";

export interface LlmTraceHooks {
  onPrompt?: (event: { operation: string; prompt: string; promptPreview: string }) => void | Promise<void>;
  onResponse?: (event: { operation: string; output: string; outputPreview: string; durationMs: number }) => void | Promise<void>;
  onError?: (event: { operation: string; durationMs: number; errorMessage: string }) => void | Promise<void>;
  maxPreviewChars?: number;
}

export class TracingLlmProvider implements ILlmProvider {
  constructor(
    private readonly inner: ILlmProvider,
    private readonly hooks: LlmTraceHooks
  ) {}

  describe(): string {
    return this.inner.describe?.() ?? "provider=unknown";
  }

  async generate(prompt: string): Promise<string> {
    const operation = classifyOperation(prompt);
    const maxPreviewChars = this.hooks.maxPreviewChars ?? 2000;
    const promptPreview = truncate(prompt, maxPreviewChars);
    await this.hooks.onPrompt?.({ operation, prompt, promptPreview });

    const startedAt = Date.now();
    try {
      const output = await this.inner.generate(prompt);
      const outputPreview = truncate(output, maxPreviewChars);
      await this.hooks.onResponse?.({
        operation,
        output,
        outputPreview,
        durationMs: Date.now() - startedAt
      });
      return output;
    } catch (error) {
      await this.hooks.onError?.({
        operation,
        durationMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : "Unknown LLM error"
      });
      throw error;
    }
  }
}

function classifyOperation(prompt: string): string {
  if (prompt.includes('"overallScore"') && prompt.includes('"scoreBreakdown"') && prompt.includes('"confidence"')) {
    return "score-pr";
  }
  if (prompt.includes('"markdown"') && prompt.toLowerCase().includes("review markdown draft")) {
    return "draft-comment";
  }
  return "unknown";
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(maxChars - 20, 20))}\n...[TRUNCATED ${text.length - maxChars} chars]`;
}
