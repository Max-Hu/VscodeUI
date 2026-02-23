import type { ConfluenceContext, ConfluencePageContext, GithubContext, JiraContext } from "../domain/types.js";
import { extractConfluenceLinks } from "../utils/contextTransform.js";
import type { SkillContext } from "./context.js";
import type { Skill } from "./skill.js";

export interface FetchConfluenceContextInput {
  githubContext: GithubContext;
  jiraContext: JiraContext;
}

export interface FetchConfluenceContextOutput {
  confluence: ConfluenceContext;
}

export class FetchConfluenceContextSkill
  implements Skill<FetchConfluenceContextInput, FetchConfluenceContextOutput, SkillContext>
{
  id = "fetch-confluence-context";
  description = "Fetch Confluence pages via strong links first, then query expansion with Jira and keywords.";

  async run(input: FetchConfluenceContextInput, context: SkillContext): Promise<FetchConfluenceContextOutput> {
    const issueLinks = input.jiraContext.issues.flatMap((issue) => issue.links ?? []);
    const prLinks = input.githubContext.signals.confluenceLinks;
    const confluenceLikeLinks = uniqueStrings(
      [...issueLinks, ...prLinks].filter((url) => isConfluenceUrl(url))
    );
    const strongLinkedUrls = confluenceLikeLinks.filter(hasConfluencePageId);

    const directPages = await context.providers.confluence.getPagesByUrls(strongLinkedUrls, {
      expandDepth: context.config.expandDepth
    });
    const taggedDirectPages = directPages.map((page) => ({
      ...page,
      source: issueLinks.includes(page.url) ? ("issue-link" as const) : ("pr-link" as const)
    }));

    const expandedSearchEnabled = context.config.providers.confluence.enableExpandedSearch ?? false;
    const queryCandidates = expandedSearchEnabled
      ? uniqueStrings([
          ...input.jiraContext.requestedKeys,
          ...input.jiraContext.issues.map((issue) => issue.summary),
          ...input.jiraContext.issues.flatMap((issue) => issue.acceptanceCriteria),
          ...input.githubContext.signals.keywords
        ]).filter((query) => query.length >= 3)
      : [];

    const searchQueries = expandedSearchEnabled ? queryCandidates.slice(0, Math.max(context.config.topK, 12)) : [];
    const searchResults = expandedSearchEnabled
      ? await Promise.all(
          searchQueries.map((query) =>
            context.providers.confluence.searchPages(query, {
              topK: Math.max(Math.floor(context.config.topK / 2), 3),
              expandDepth: context.config.expandDepth
            })
          )
        )
      : [];

    const taggedSearchedPages = searchResults.flatMap((pages, index) => {
      const query = searchQueries[index].toUpperCase();
      const isJiraQuery = /[A-Z][A-Z0-9]+-\d+/.test(query);
      return pages.map((page) => ({
        ...page,
        source: isJiraQuery ? ("jira-query" as const) : ("keyword-query" as const)
      }));
    });

    const allPages = dedupePages([...taggedDirectPages, ...taggedSearchedPages]);
    const queryFromLinks = extractConfluenceLinks(strongLinkedUrls);

    return {
      confluence: {
        strongLinkedUrls: uniqueStrings(queryFromLinks),
        searchQueries,
        pages: allPages
      }
    };
  }
}

function hasConfluencePageId(value: string): boolean {
  if (/\/rest\/api\/content\/\d+(?:\/|$)/i.test(value)) {
    return true;
  }
  if (/\/pages\/\d+(?:\/|$)/i.test(value)) {
    return true;
  }
  try {
    const parsed = new URL(value);
    const pageId = parsed.searchParams.get("pageId");
    return Boolean(pageId && /^\d+$/.test(pageId));
  } catch {
    return false;
  }
}

function dedupePages(pages: ConfluencePageContext[]): ConfluencePageContext[] {
  const seen = new Set<string>();
  const deduped: ConfluencePageContext[] = [];

  for (const page of pages) {
    const key = page.url || page.id;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(page);
  }
  return deduped;
}

function isConfluenceUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    const normalizedPath = parsed.pathname.toLowerCase();
    const hasPageId = parsed.searchParams.has("pageId");
    if (hasPageId) {
      return true;
    }

    if (normalizedPath.includes("/wiki/") || normalizedPath.endsWith("/wiki")) {
      return true;
    }
    if (/\/rest\/api\/content\/\d+(?:\/|$)/i.test(normalizedPath)) {
      return true;
    }
    if (normalizedPath.includes("/pages/")) {
      return true;
    }
    if (normalizedPath.includes("/spaces/")) {
      return true;
    }
    if (normalizedPath.includes("/display/")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
