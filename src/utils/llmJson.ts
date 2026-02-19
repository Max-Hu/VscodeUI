export function parseJsonFromLlm<T>(raw: string): T {
  const direct = tryParseJson<T>(raw);
  if (direct !== undefined) {
    return direct;
  }

  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const parsedFenced = tryParseJson<T>(fenced[1]);
    if (parsedFenced !== undefined) {
      return parsedFenced;
    }
  }

  throw new Error("LLM response is not valid JSON.");
}

function tryParseJson<T>(text: string): T | undefined {
  try {
    return JSON.parse(text.trim()) as T;
  } catch {
    return undefined;
  }
}
