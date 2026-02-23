import type { PrReference } from "../domain/types.js";

export class PrLinkParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrLinkParseError";
  }
}

export function parsePrLink(prLink: string): PrReference {
  let url: URL;
  try {
    url = new URL(prLink);
  } catch {
    throw new PrLinkParseError("PR link is not a valid URL.");
  }

  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
  if (!match) {
    throw new PrLinkParseError("PR link must match https://{host}/{owner}/{repo}/pull/{number}.");
  }

  const [, owner, repo, prNumberText] = match;
  const prNumber = Number(prNumberText);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new PrLinkParseError("PR number must be a positive integer.");
  }

  return { owner, repo, prNumber };
}
