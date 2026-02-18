export type ReviewProfile = "default" | "security" | "performance" | "compliance";

export interface ReviewRequest {
  prLink: string;
  reviewProfile?: ReviewProfile;
  additionalKeywords?: string[];
}

export interface PrReference {
  owner: string;
  repo: string;
  prNumber: number;
}

export interface PullRequestMetadata {
  title: string;
  body: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  url: string;
}

export interface PullRequestFile {
  path: string;
  patch: string;
  truncated: boolean;
}

export interface PullRequestCommit {
  sha: string;
  message: string;
}

export interface PullRequestCheck {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "cancelled" | "timed_out" | "neutral" | null;
}

export interface PullRequestComment {
  author: string;
  body: string;
}

export interface GithubPullRequestPayload {
  metadata: PullRequestMetadata;
  files: Array<{
    path: string;
    patch: string;
  }>;
  commits: PullRequestCommit[];
  checks: PullRequestCheck[];
  comments: PullRequestComment[];
}

export interface GithubSignals {
  confluenceLinks: string[];
  keywords: string[];
}

export interface GithubContext {
  metadata: PullRequestMetadata;
  files: PullRequestFile[];
  commits: PullRequestCommit[];
  checks: PullRequestCheck[];
  comments: PullRequestComment[];
  signals: GithubSignals;
}

export interface JiraIssueContext {
  key: string;
  summary: string;
  description: string;
  acceptanceCriteria: string[];
  nfr: string[];
  risks: string[];
  testingRequirements: string[];
}

export interface JiraContext {
  requestedKeys: string[];
  issues: JiraIssueContext[];
}

export interface ReviewContext {
  prReference: PrReference;
  profile: ReviewProfile;
  github: GithubContext;
  jira: JiraContext;
}

export type ScoreDimension =
  | "Correctness"
  | "Maintainability"
  | "Reliability"
  | "Security"
  | "Performance"
  | "Test Quality"
  | "Traceability";

export interface ScoreBreakdownItem {
  dimension: ScoreDimension;
  score: number;
  weight: number;
  rationale: string;
}

export interface ScoreEvidenceItem {
  file?: string;
  snippet?: string;
}

export interface ScoreResult {
  overallScore: number;
  scoreBreakdown: ScoreBreakdownItem[];
  evidence: ScoreEvidenceItem[];
  confidence: "low" | "medium" | "high";
}

export interface DraftComment {
  markdown: string;
}

export interface Stage1ReviewResult {
  context: ReviewContext;
  score: ScoreResult;
  draft: DraftComment;
}
