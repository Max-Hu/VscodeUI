import type { ConfluencePageContext } from "../../domain/types.js";
import type { IConfluenceProvider } from "../confluenceProvider.js";

export interface MockConfluenceDataset {
  byUrl?: Record<string, Omit<ConfluencePageContext, "source">>;
  byQuery?: Record<string, Array<Omit<ConfluencePageContext, "source">>>;
}

export class MockConfluenceProvider implements IConfluenceProvider {
  constructor(private readonly dataset: MockConfluenceDataset) {}

  async getPagesByUrls(urls: string[], _options: { expandDepth: number }): Promise<ConfluencePageContext[]> {
    const byUrl = this.dataset.byUrl ?? {};
    return urls
      .map((url) => byUrl[url])
      .filter((page): page is Omit<ConfluencePageContext, "source"> => Boolean(page))
      .map((page) => ({ ...page, source: "pr-link" }));
  }

  async searchPages(query: string, options: { topK: number; expandDepth: number }): Promise<ConfluencePageContext[]> {
    const byQuery = this.dataset.byQuery ?? {};
    const normalized = query.toLowerCase().trim();
    const pages = byQuery[normalized] ?? [];
    return pages.slice(0, options.topK).map((page) => ({ ...page, source: "keyword-query" }));
  }
}
