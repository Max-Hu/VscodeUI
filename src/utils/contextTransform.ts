import type { GithubPullRequestPayload, PullRequestFile } from "../domain/types.js";

export function trimPullRequestFiles(
  files: GithubPullRequestPayload["files"],
  maxFiles: number,
  maxPatchCharsPerFile: number
): PullRequestFile[] {
  return files.slice(0, maxFiles).map((file) => {
    const patch = file.patch ?? "";
    const truncated = patch.length > maxPatchCharsPerFile;
    return {
      path: file.path,
      patch: truncated ? `${patch.slice(0, maxPatchCharsPerFile)}\n[TRUNCATED]` : patch,
      truncated
    };
  });
}

export function extractConfluenceLinks(textChunks: string[]): string[] {
  const text = textChunks.filter(Boolean).join("\n");
  const linkPattern = /(https?:\/\/[^\s)]+(?:confluence|wiki)[^\s)]*)/gi;
  const matches = [...text.matchAll(linkPattern)].map((match) => match[0]);
  return [...new Set(matches)];
}

export function collectKeywords(textChunks: string[], explicitKeywords: string[]): string[] {
  const tokenPattern = /\b[a-zA-Z][a-zA-Z0-9_-]{2,}\b/g;
  const textTokens = textChunks
    .filter(Boolean)
    .flatMap((chunk) => [...chunk.toLowerCase().matchAll(tokenPattern)].map((m) => m[0]));

  const normalizedExplicit = explicitKeywords.map((keyword) => keyword.toLowerCase().trim()).filter(Boolean);
  return [...new Set([...normalizedExplicit, ...textTokens])].slice(0, 60);
}
