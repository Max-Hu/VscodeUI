import { clampScore, confidenceFromSignals, weightedOverallScore } from "../utils/scoring.js";
const DIMENSIONS = [
    "Correctness",
    "Maintainability",
    "Reliability",
    "Security",
    "Performance",
    "Test Quality",
    "Traceability"
];
export class ScorePrSkill {
    id = "score-pr";
    description = "Generate deterministic stage-1 score from PR and Jira context.";
    async run(input, context) {
        const { githubContext, jiraContext, profile } = input;
        const checks = githubContext.checks;
        const files = githubContext.files;
        const keywords = new Set(githubContext.signals.keywords.map((k) => k.toLowerCase()));
        const hasFailures = checks.some((check) => check.conclusion === "failure" || check.conclusion === "timed_out");
        const successChecks = checks.filter((check) => check.conclusion === "success").length;
        const hasChecks = checks.length > 0;
        const hasTestFiles = files.some((file) => /(^|\/)(test|tests|__tests__)\//i.test(file.path) || /\.test\./i.test(file.path));
        const totalPatchChars = files.reduce((sum, file) => sum + file.patch.length, 0);
        const jiraCoverageRatio = jiraContext.requestedKeys.length
            ? jiraContext.issues.length / jiraContext.requestedKeys.length
            : 0;
        const scores = {
            Correctness: clampScore(70 + successChecks * 4 - (hasFailures ? 25 : 0) - (!hasChecks ? 5 : 0)),
            Maintainability: clampScore(88 - files.length * 1.5 - totalPatchChars / 3000),
            Reliability: clampScore(72 + (hasChecks ? 8 : 0) - (hasFailures ? 20 : 0)),
            Security: clampScore(70 +
                (profile === "security" ? 8 : 0) +
                (keywords.has("security") || keywords.has("auth") ? 4 : 0) -
                (hasFailures ? 5 : 0)),
            Performance: clampScore(70 + (profile === "performance" ? 8 : 0) + (keywords.has("performance") || keywords.has("cache") ? 4 : 0)),
            "Test Quality": clampScore(55 + (hasTestFiles ? 25 : 0) + (hasChecks ? 10 : 0)),
            Traceability: clampScore(45 + jiraCoverageRatio * 55)
        };
        const scoreBreakdown = DIMENSIONS.map((dimension) => ({
            dimension,
            score: scores[dimension],
            weight: context.config.scoring.weights[dimension],
            rationale: buildRationale(dimension, {
                hasChecks,
                hasFailures,
                hasTestFiles,
                jiraCoverageRatio,
                profile
            })
        }));
        const evidence = [
            ...files.slice(0, 3).map((file) => ({
                file: file.path,
                snippet: file.patch.slice(0, 220)
            })),
            ...jiraContext.issues.slice(0, 2).map((issue) => ({
                snippet: `${issue.key}: ${issue.summary}`
            }))
        ];
        const score = {
            overallScore: weightedOverallScore(scoreBreakdown),
            scoreBreakdown,
            evidence,
            confidence: confidenceFromSignals({
                checksCount: checks.length,
                jiraIssueCount: jiraContext.issues.length,
                hasFailures
            })
        };
        return { score };
    }
}
function buildRationale(dimension, input) {
    const { hasChecks, hasFailures, hasTestFiles, jiraCoverageRatio, profile } = input;
    switch (dimension) {
        case "Correctness":
            return hasFailures ? "CI contains failed checks; correctness confidence reduced." : "No failing checks observed.";
        case "Maintainability":
            return "Patch volume and changed file count were used for maintainability estimation.";
        case "Reliability":
            return hasChecks ? "Automated checks exist and contribute to reliability signal." : "Missing checks lowers reliability confidence.";
        case "Security":
            return profile === "security"
                ? "Security profile increases strictness and weight of security signals."
                : "Security score based on keywords and check outcomes.";
        case "Performance":
            return profile === "performance"
                ? "Performance profile increases performance sensitivity."
                : "Performance score based on repository signals only.";
        case "Test Quality":
            return hasTestFiles ? "Test-related file changes detected." : "No explicit test-file changes detected.";
        case "Traceability":
            return `Jira coverage ratio is ${(jiraCoverageRatio * 100).toFixed(0)}%.`;
        default:
            return "Scored from available signals.";
    }
}
