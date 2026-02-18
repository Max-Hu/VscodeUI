function ensureGlobal(pattern) {
    return pattern.flags.includes("g")
        ? pattern
        : new RegExp(pattern.source, `${pattern.flags}g`);
}
export function extractJiraKeysFromText(text, keyPattern) {
    const normalized = text ?? "";
    if (!normalized.trim()) {
        return [];
    }
    const matches = [...normalized.matchAll(ensureGlobal(keyPattern))].map((m) => m[0].toUpperCase());
    return [...new Set(matches)].sort();
}
export function extractJiraKeysFromCommits(commits, keyPattern) {
    const keys = commits.flatMap((commit) => extractJiraKeysFromText(commit.message, keyPattern));
    return [...new Set(keys)].sort();
}
