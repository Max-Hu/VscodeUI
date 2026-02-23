import type { ProviderConnectionConfig } from "../../config/types.js";
import type { ConfluencePageContext } from "../../domain/types.js";
import type { IConfluenceProvider } from "../confluenceProvider.js";
import { HttpJsonClient } from "./httpJsonClient.js";

export class ConfluenceRestProvider implements IConfluenceProvider {
  private readonly client: HttpJsonClient;
  private readonly baseDomain: string;

  constructor(connection: ProviderConnectionConfig, options?: { disableTlsValidation?: boolean }) {
    const normalizedDomain = normalizeDomain(connection.domain);
    const baseDomain = resolveConfluenceSiteBase(normalizedDomain);
    this.baseDomain = baseDomain;
    this.client = new HttpJsonClient({
      providerName: "Confluence",
      baseUrl: resolveConfluenceApiBase(normalizedDomain),
      credential: connection.credential,
      disableTlsValidation: options?.disableTlsValidation
    });
  }

  async getPagesByUrls(urls: string[], _options: { expandDepth: number }): Promise<ConfluencePageContext[]> {
    const uniqueUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
    const pages: ConfluencePageContext[] = [];

    for (const url of uniqueUrls) {
      const pageId = extractConfluencePageId(url);
      if (!pageId) {
        continue;
      }

      try {
        const raw = await this.client.requestJson<any>(`/content/${pageId}`, {
          query: {
            expand: "body.storage"
          }
        });
        pages.push({
          id: asString(raw?.id, pageId),
          title: asString(raw?.title, `Confluence ${pageId}`),
          url,
          content: htmlToText(asString(raw?.body?.storage?.value)),
          source: "pr-link"
        });
      } catch {
        // skip pages that cannot be resolved
      }
    }

    return pages;
  }

  async searchPages(query: string, options: { topK: number; expandDepth: number }): Promise<ConfluencePageContext[]> {
    const normalized = query.trim();
    if (!normalized) {
      return [];
    }

    const response = await this.client.requestJson<any>("/content/search", {
      query: {
        cql: `text ~ "${escapeCql(normalized)}"`,
        limit: Math.max(1, options.topK),
        expand: "body.storage"
      }
    });

    const results = Array.isArray(response?.results) ? response.results : [];
    return results.map((item: any) => {
      const webUi = asString(item?._links?.webui);
      const resultUrl = webUi
        ? `${stripTrailingSlash(asString(item?._links?.base, this.baseDomain))}${webUi}`
        : `${this.baseDomain}/pages/${asString(item?.id)}`;

      return {
        id: asString(item?.id),
        title: asString(item?.title, "Confluence Page"),
        url: resultUrl,
        content: htmlToText(asString(item?.body?.storage?.value)),
        source: "keyword-query"
      };
    });
  }
}

function resolveConfluenceApiBase(domain: string): string {
  const normalized = stripTrailingSlash(domain);
  if (normalized.endsWith("/confluence/rest/api")) {
    return normalized;
  }
  if (normalized.endsWith("/confluence")) {
    return `${normalized}/rest/api`;
  }
  if (normalized.includes("/confluence/") && !/\/rest\/api$/i.test(normalized)) {
    return `${normalized.replace(/\/+$/, "")}/rest/api`;
  }
  throw new Error("Confluence provider domain must match https://{host}/confluence or https://{host}/confluence/rest/api.");
}

function resolveConfluenceSiteBase(domain: string): string {
  const normalized = stripTrailingSlash(domain);
  if (normalized.endsWith("/confluence/rest/api")) {
    return normalized.replace(/\/rest\/api$/i, "");
  }
  return normalized;
}

function extractConfluencePageId(url: string): string | undefined {
  const pagesMatch = url.match(/\/pages\/(\d+)/);
  if (pagesMatch?.[1]) {
    return pagesMatch[1];
  }
  const apiContentMatch = url.match(/\/rest\/api\/content\/(\d+)(?:\/|$)/i);
  if (apiContentMatch?.[1]) {
    return apiContentMatch[1];
  }
  try {
    const parsed = new URL(url);
    const pageId = parsed.searchParams.get("pageId");
    if (pageId && /^\d+$/.test(pageId)) {
      return pageId;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function htmlToText(input: string): string {
  if (!input) {
    return "";
  }
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeCql(input: string): string {
  return input.replace(/"/g, '\\"');
}

function normalizeDomain(domain: string): string {
  return stripTrailingSlash(domain.trim());
}

function stripTrailingSlash(input: string): string {
  return input.replace(/\/+$/, "");
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}
