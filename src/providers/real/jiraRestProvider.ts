import type { ProviderConnectionConfig } from "../../config/types.js";
import type { JiraIssueContext } from "../../domain/types.js";
import type { IJiraProvider } from "../jiraProvider.js";
import { HttpJsonClient } from "./httpJsonClient.js";

interface QueueItem {
  key: string;
  depth: number;
}

export class JiraRestProvider implements IJiraProvider {
  private readonly client: HttpJsonClient;

  constructor(connection: ProviderConnectionConfig, options?: { disableTlsValidation?: boolean }) {
    this.client = new HttpJsonClient({
      providerName: "Jira",
      baseUrl: resolveJiraApiBase(connection.domain),
      credential: connection.credential,
      disableTlsValidation: options?.disableTlsValidation
    });
  }

  async getIssues(keys: string[], options: { expandDepth: number }): Promise<JiraIssueContext[]> {
    const normalizedKeys = uniqueStrings(keys.map((key) => key.toUpperCase()));
    if (normalizedKeys.length === 0) {
      return [];
    }

    const maxDepth = Math.max(0, options.expandDepth ?? 0);
    const queue: QueueItem[] = normalizedKeys.map((key) => ({ key, depth: 0 }));
    const visited = new Set<string>();
    const contexts: JiraIssueContext[] = [];

    while (queue.length > 0 && contexts.length < 200) {
      const current = queue.shift();
      if (!current) {
        break;
      }
      if (visited.has(current.key)) {
        continue;
      }
      visited.add(current.key);

      const issue = await this.fetchIssue(current.key);
      if (!issue) {
        continue;
      }

      const remoteLinks = await this.fetchRemoteLinks(issue.key);
      contexts.push(mapIssue(issue, remoteLinks));

      if (current.depth >= maxDepth) {
        continue;
      }

      for (const linked of extractLinkedIssueKeys(issue)) {
        if (!visited.has(linked)) {
          queue.push({
            key: linked,
            depth: current.depth + 1
          });
        }
      }
    }

    if (contexts.length === 0) {
      throw new Error(`No Jira issues were found for keys: ${normalizedKeys.join(", ")}`);
    }

    return contexts;
  }

  private async fetchIssue(key: string): Promise<any | undefined> {
    try {
      return await this.client.requestJson<any>(`/issue/${encodeURIComponent(key)}`, {
        query: {
          fields:
            "summary,description,parent,subtasks,issuelinks"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes(" 404 ")) {
        return undefined;
      }
      throw error;
    }
  }

  private async fetchRemoteLinks(key: string): Promise<string[]> {
    try {
      const response = await this.client.requestJson<any[]>(`/issue/${encodeURIComponent(key)}/remotelink`);
      if (!Array.isArray(response)) {
        return [];
      }
      return response
        .map((item) => asString(item?.object?.url))
        .filter((url) => /^https?:\/\//.test(url));
    } catch {
      return [];
    }
  }
}

function resolveJiraApiBase(domain: string): string {
  const normalized = domain.trim().replace(/\/+$/, "");
  if (!normalized) {
    return normalized;
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Jira provider domain must be a valid URL and match https://{host}/jira.");
  }

  const pathname = parsed.pathname.replace(/\/+$/, "");
  if (/\/jira\/rest\/api\/2$/i.test(pathname)) {
    return normalized;
  }
  if (/\/jira$/i.test(pathname)) {
    return `${normalized}/rest/api/2`;
  }
  throw new Error("Jira provider domain must match https://{host}/jira or https://{host}/jira/rest/api/2.");
}

function mapIssue(raw: any, remoteLinks: string[]): JiraIssueContext {
  const fields = raw?.fields ?? {};
  const description = adfToText(fields.description);
  const sections = extractSections(description);
  const descriptionLinks = extractUrls(description);
  const links = uniqueStrings([...descriptionLinks, ...remoteLinks]);

  return {
    key: asString(raw?.key),
    summary: asString(fields.summary),
    description,
    acceptanceCriteria: sections.acceptanceCriteria,
    nfr: sections.nfr,
    risks: sections.risks,
    testingRequirements: sections.testingRequirements,
    links
  };
}

function extractLinkedIssueKeys(raw: any): string[] {
  const fields = raw?.fields ?? {};
  const keys: string[] = [];

  const parent = asString(fields.parent?.key).toUpperCase();
  if (parent) {
    keys.push(parent);
  }

  const subtasks = Array.isArray(fields.subtasks) ? fields.subtasks : [];
  for (const subtask of subtasks) {
    const key = asString(subtask?.key).toUpperCase();
    if (key) {
      keys.push(key);
    }
  }

  const issueLinks = Array.isArray(fields.issuelinks) ? fields.issuelinks : [];
  for (const link of issueLinks) {
    const outward = asString(link?.outwardIssue?.key).toUpperCase();
    const inward = asString(link?.inwardIssue?.key).toUpperCase();
    if (outward) {
      keys.push(outward);
    }
    if (inward) {
      keys.push(inward);
    }
  }

  return uniqueStrings(keys.filter((key) => /[A-Z][A-Z0-9]+-\d+/.test(key)));
}

function extractSections(text: string): {
  acceptanceCriteria: string[];
  nfr: string[];
  risks: string[];
  testingRequirements: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = {
    acceptanceCriteria: [] as string[],
    nfr: [] as string[],
    risks: [] as string[],
    testingRequirements: [] as string[]
  };

  let current: keyof typeof sections | undefined;
  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (/^acceptance criteria[:]?/.test(normalized)) {
      current = "acceptanceCriteria";
      pushTail(line, sections.acceptanceCriteria);
      continue;
    }
    if (/^(nfr|non-functional requirements?)[:]?/.test(normalized)) {
      current = "nfr";
      pushTail(line, sections.nfr);
      continue;
    }
    if (/^risks?[:]?/.test(normalized)) {
      current = "risks";
      pushTail(line, sections.risks);
      continue;
    }
    if (/^(testing requirements?|tests?)[:]?/.test(normalized)) {
      current = "testingRequirements";
      pushTail(line, sections.testingRequirements);
      continue;
    }
    if (current) {
      const cleaned = line.replace(/^[-*]\s+/, "").trim();
      if (cleaned) {
        sections[current].push(cleaned);
      }
    }
  }

  return sections;
}

function pushTail(line: string, target: string[]): void {
  const index = line.indexOf(":");
  if (index < 0) {
    return;
  }
  const value = line.slice(index + 1).trim();
  if (value) {
    target.push(value);
  }
}

function adfToText(value: unknown): string {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => adfToText(item)).filter(Boolean).join("\n");
  }
  if (typeof value === "object") {
    const node = value as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text") {
      return node.text ?? "";
    }
    const contentText = Array.isArray(node.content) ? node.content.map((item) => adfToText(item)).join("\n") : "";
    return contentText;
  }
  return "";
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)]+/gi) ?? [];
  return uniqueStrings(matches);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}
