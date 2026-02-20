import type { Stage1Config } from "./types.js";

export const defaultStage1Config: Stage1Config = {
  expandDepth: 1,
  topK: 20,
  maxFiles: 80,
  maxPatchCharsPerFile: 4000,
  jiraKeyPattern: "[A-Z][A-Z0-9]+-\\d+",
  providers: {
    github: {
      domain: "https://api.github.com",
      credential: {
        mode: "none"
      }
    },
    jira: {
      domain: "https://your-domain.atlassian.net",
      credential: {
        mode: "none"
      }
    },
    confluence: {
      domain: "https://your-domain.atlassian.net/wiki",
      credential: {
        mode: "none"
      }
    }
  },
  llm: {
    mode: "copilot"
  },
  post: {
    enabled: true,
    requireConfirmation: true
  },
  resilience: {
    continueOnConfluenceError: true
  },
  observability: {
    enabled: true,
    verboseLogs: false
  },
  scoring: {
    weights: {
      Correctness: 0.24,
      Maintainability: 0.14,
      Reliability: 0.18,
      Security: 0.14,
      Performance: 0.1,
      "Test Quality": 0.1,
      Traceability: 0.1
    }
  }
};
