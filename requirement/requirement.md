# Product Requirement Specification

## 1. Goal

Build a VS Code extension panel that accepts a PR link and produces a complete review workflow:

- aggregate GitHub, Jira, and Confluence context
- evaluate and score with Copilot
- generate an editable markdown draft
- publish after explicit confirmation

## 2. Input and Trigger

### 2.1 User Input (Panel)

- PR link (required)
- Review profile (optional): `default | security | performance | compliance`
- Additional keywords (optional)

### 2.2 PR Link Rules

Only support GitHub PR URLs in this format:

`https://github.com/{owner}/{repo}/pull/{number}`

Parser must extract:

- owner
- repo
- prNumber

Invalid URLs must fail fast with a clear error.

## 3. Architecture Constraints

### 3.1 Layering

- `views/`: UI and message transport only
- `orchestrator/`: workflow composition
- `skills/`: pluggable capability units
- `providers/`: GitHub/Jira/Confluence adapters
- `llm/`: LLM abstraction
- `domain/`: business types
- `config/`: settings and defaults
- `security/`: secret handling
- `utils/`: shared helpers

### 3.2 Hard Rules

- No business logic in `extension.ts`
- Webview must not access secrets directly
- Providers must not call each other directly

## 4. Skills Pipeline

Required skills:

1. `fetch-github-context`
- load metadata, files/patches, commits, checks, comments
- extract signals: Jira keys, Confluence links, keywords

2. `extract-jira-keys`
- extract Jira keys from commit messages
- regex configurable
- deduplicate and sort

3. `fetch-jira-context`
- retrieve issues by keys
- optional graph expansion (`depth`)
- extract summary/description/AC/NFR/risk/testing requirements

4. `fetch-confluence-context`
- strong-link first (issue links + PR links)
- fallback query expansion
- optional related page expansion

5. `aggregate-context`
- deduplicate, rank by relevance, truncate by topK
- produce final `ReviewContext`
- preserve Jira -> Confluence traceability mapping

6. `score-pr`
- compute `overallScore` (0-100)
- output dimension breakdown, evidence, confidence

7. `draft-comment`
- generate markdown review draft

8. `publish-comment`
- publish edited draft text
- requires explicit confirmation

## 5. Context Retrieval Strategy

### 5.1 Retrieval Order

- Strong association first
- Weak association second
- Optional expansion last

### 5.2 GitHub Scope

Required data:

- PR metadata
- changed files + patch (with truncation)
- commits (must support Jira extraction from commit messages)
- check status
- comments

Truncation controls:

- `maxFiles`
- `maxPatchCharsPerFile`
- mark truncation explicitly

### 5.3 Jira Scope

- exact key lookup
- optional parent/epic/children expansion
- prioritize AC, NFR, risk, testing requirements

### 5.4 Confluence Scope

Priority:

1. links from Jira issues
2. links from PR text/comments
3. keyword/Jira-based search

## 6. Scoring Output Contract

```ts
{
  overallScore: number;
  scoreBreakdown: Array<{
    dimension: string;
    score: number;
    weight: number;
    rationale: string;
  }>;
  evidence: Array<{
    file?: string;
    snippet?: string;
  }>;
  confidence: "low" | "medium" | "high";
}
```

Default dimensions:

- Correctness
- Maintainability
- Reliability
- Security
- Performance
- Test Quality
- Traceability

Weights must be configurable.

## 7. LLM Integration

### 7.1 Contract

```ts
interface ILlmProvider {
  generate(prompt: string): Promise<string>;
}
```

### 7.2 Modes

- `copilot` (default)
- `external`
- `mock`

### 7.3 Copilot Rules

- use VS Code LM API
- do not manage Copilot tokens manually
- degrade gracefully when unavailable

## 8. Publish Flow

- generate draft comment
- user edits in panel
- click publish
- show second confirmation
- publish and show result URL

## 9. Configuration and Credentials

### 9.1 Settings

- `expandDepth`
- `topK`
- `maxFiles`
- `maxPatchCharsPerFile`
- `scoring.weights`
- `llm.mode`
- `post.enabled`

### 9.2 Credential Modes

- GitHub: `pat | oauth | vscodeAuth`
- Jira: `pat | basic | oauth`
- Confluence: `pat | basic | oauth`

Sensitive values should come from SecretStorage.

## 10. Testing Requirements

Must cover:

- PR URL parsing
- Jira key extraction
- context truncation
- relevance ranking
- scoring logic
- JSON parse/fallback handling
- publish uses edited text
- skill unit tests
- orchestrator end-to-end tests with mocks

## 11. Code Quality Requirements

- small focused functions
- single responsibility
- interface-driven dependency injection
- avoid circular dependencies
- provider layer independent from UI
- each skill testable in isolation
- orchestrator handles sequencing only

## 12. MVP Acceptance

- review runs from PR link input
- Jira key extraction works from commits
- Jira/Confluence context is linked
- score + structured output produced
- edited draft can be published
- unit tests pass
- Copilot call path works in extension host
