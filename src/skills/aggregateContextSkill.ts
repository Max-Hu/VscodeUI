import type {
  ConfluenceContext,
  ConfluencePageContext,
  GithubContext,
  JiraContext,
  PrReference,
  ReviewContext,
  ReviewProfile
} from "../domain/types.js";
import type { SkillContext } from "./context.js";
import type { Skill } from "./skill.js";

export interface AggregateContextInput {
  prReference: PrReference;
  profile: ReviewProfile;
  githubContext: GithubContext;
  jiraContext: JiraContext;
  confluenceContext: ConfluenceContext;
}

export interface AggregateContextOutput {
  reviewContext: ReviewContext;
}

export class AggregateContextSkill
  implements Skill<AggregateContextInput, AggregateContextOutput, SkillContext>
{
  id = "aggregate-context";
  description = "Build normalized review context with relevance ranking and traceability mapping.";

  async run(input: AggregateContextInput, context: SkillContext): Promise<AggregateContextOutput> {
    const jiraKeys = input.jiraContext.requestedKeys;
    const keywords = input.githubContext.signals.keywords.map((keyword) => keyword.toLowerCase());
    const strongLinked = new Set(input.confluenceContext.strongLinkedUrls);

    const rankedConfluence = input.confluenceContext.pages
      .map((page) => withRelevance(page, jiraKeys, keywords, strongLinked))
      .sort(
        (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0) || a.title.localeCompare(b.title)
      )
      .slice(0, context.config.topK);

    const traceability = buildTraceability(jiraKeys, rankedConfluence);

    return {
      reviewContext: {
        prReference: input.prReference,
        profile: input.profile,
        github: input.githubContext,
        jira: input.jiraContext,
        confluence: {
          ...input.confluenceContext,
          pages: rankedConfluence
        },
        traceability
      }
    };
  }
}

function withRelevance(
  page: ConfluencePageContext,
  jiraKeys: string[],
  keywords: string[],
  strongLinked: Set<string>
): ConfluencePageContext {
  const combined = `${page.title}\n${page.content}\n${page.url}`.toLowerCase();
  const matchedJiraKeys = jiraKeys.filter((key) => combined.includes(key.toLowerCase()));
  const matchedKeywords = keywords.filter((keyword) => combined.includes(keyword));

  const sourceBoost =
    page.source === "issue-link" ? 45 : page.source === "pr-link" ? 38 : page.source === "jira-query" ? 25 : 18;
  const linkBoost = strongLinked.has(page.url) ? 15 : 0;
  const jiraBoost = Math.min(25, matchedJiraKeys.length * 12);
  const keywordBoost = Math.min(20, matchedKeywords.length * 2);
  const relevanceScore = Math.max(0, Math.min(100, sourceBoost + linkBoost + jiraBoost + keywordBoost));

  return {
    ...page,
    relevanceScore,
    matchedJiraKeys,
    matchedKeywords
  };
}

function buildTraceability(jiraKeys: string[], pages: ConfluencePageContext[]): ReviewContext["traceability"] {
  const jiraToConfluence: Record<string, string[]> = {};
  for (const key of jiraKeys) {
    const urls = pages.filter((page) => (page.matchedJiraKeys ?? []).includes(key)).map((page) => page.url);
    jiraToConfluence[key] = [...new Set(urls)];
  }
  return { jiraToConfluence };
}
