export function clampScore(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}
export function weightedOverallScore(items) {
    const weightedTotal = items.reduce((sum, item) => sum + item.score * item.weight, 0);
    const weightSum = items.reduce((sum, item) => sum + item.weight, 0);
    if (!weightSum) {
        return 0;
    }
    return clampScore(weightedTotal / weightSum);
}
export function confidenceFromSignals(input) {
    if (input.checksCount > 0 && input.jiraIssueCount > 0 && !input.hasFailures) {
        return "high";
    }
    if (input.checksCount > 0 || input.jiraIssueCount > 0) {
        return "medium";
    }
    return "low";
}
