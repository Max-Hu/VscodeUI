const PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function renderPromptTemplate(template: string, values: Record<string, string>): string {
  const rendered = template.replace(PLACEHOLDER_PATTERN, (_full, key: string) => {
    if (!(key in values)) {
      throw new Error(`Missing prompt template variable: ${key}`);
    }
    return values[key];
  });

  const unresolved = [...rendered.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]);
  if (unresolved.length > 0) {
    throw new Error(`Unresolved prompt template variables: ${[...new Set(unresolved)].join(", ")}`);
  }

  return rendered;
}
