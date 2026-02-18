import { collectKeywords, extractConfluenceLinks, trimPullRequestFiles } from "../utils/contextTransform.js";
import { parsePrLink } from "../utils/parsePrLink.js";
export class FetchGithubContextSkill {
    id = "fetch-github-context";
    description = "Load PR metadata, files, commits, checks, comments and extract base signals.";
    async run(input, context) {
        const prReference = parsePrLink(input.request.prLink);
        const payload = await context.providers.github.getPullRequest(prReference);
        const files = trimPullRequestFiles(payload.files, context.config.maxFiles, context.config.maxPatchCharsPerFile);
        const textChunks = [
            payload.metadata.title,
            payload.metadata.body,
            ...payload.comments.map((comment) => comment.body)
        ];
        const confluenceLinks = extractConfluenceLinks(textChunks);
        const keywords = collectKeywords(textChunks, input.request.additionalKeywords ?? []);
        return {
            prReference,
            githubContext: {
                metadata: payload.metadata,
                files,
                commits: payload.commits,
                checks: payload.checks,
                comments: payload.comments,
                signals: {
                    confluenceLinks,
                    keywords
                }
            }
        };
    }
}
