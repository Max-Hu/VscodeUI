export class PrLinkParseError extends Error {
    constructor(message) {
        super(message);
        this.name = "PrLinkParseError";
    }
}
export function parsePrLink(prLink) {
    let url;
    try {
        url = new URL(prLink);
    }
    catch {
        throw new PrLinkParseError("PR link is not a valid URL.");
    }
    if (url.hostname !== "github.com") {
        throw new PrLinkParseError("Only GitHub PR links are supported.");
    }
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
    if (!match) {
        throw new PrLinkParseError("PR link must match https://github.com/{owner}/{repo}/pull/{number}.");
    }
    const [, owner, repo, prNumberText] = match;
    const prNumber = Number(prNumberText);
    if (!Number.isInteger(prNumber) || prNumber <= 0) {
        throw new PrLinkParseError("PR number must be a positive integer.");
    }
    return { owner, repo, prNumber };
}
