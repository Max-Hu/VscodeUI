import type { ConfluencePageContext } from "../domain/types.js";

export interface IConfluenceProvider {
  getPagesByUrls(urls: string[], options: { expandDepth: number }): Promise<ConfluencePageContext[]>;
  searchPages(query: string, options: { topK: number; expandDepth: number }): Promise<ConfluencePageContext[]>;
}
