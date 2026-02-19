import type { ILlmProvider } from "./llmProvider.js";

export class CopilotLlmProvider implements ILlmProvider {
  async generate(prompt: string): Promise<string> {
    const vscode = await loadVsCode();
    const lm = vscode?.lm;
    if (!lm?.selectChatModels) {
      throw new Error("VS Code LM API is unavailable.");
    }

    const models = await lm.selectChatModels({ vendor: "copilot" });
    if (!Array.isArray(models) || models.length === 0) {
      throw new Error("No Copilot chat model is available.");
    }

    const model = models[0];
    const message = vscode.LanguageModelChatMessage?.User
      ? vscode.LanguageModelChatMessage.User(prompt)
      : { role: "user", content: prompt };

    const request = await model.sendRequest([message], {});
    return await readLmText(request?.text);
  }
}

async function loadVsCode(): Promise<any> {
  try {
    const importVsCode = new Function("return import('vscode')") as () => Promise<any>;
    return await importVsCode();
  } catch {
    throw new Error("VS Code runtime is unavailable. Copilot provider must run in extension host.");
  }
}

async function readLmText(stream: unknown): Promise<string> {
  if (!stream) {
    throw new Error("Copilot response stream is empty.");
  }
  if (typeof stream === "string") {
    return stream;
  }
  if (isAsyncIterable(stream)) {
    let output = "";
    for await (const part of stream) {
      output += stringifyLmPart(part);
    }
    if (!output.trim()) {
      throw new Error("Copilot returned empty text.");
    }
    return output;
  }
  return stringifyLmPart(stream);
}

function stringifyLmPart(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }
  if (part && typeof part === "object" && "value" in part && typeof (part as { value: unknown }).value === "string") {
    return (part as { value: string }).value;
  }
  return String(part ?? "");
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return Boolean(value && typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function");
}
