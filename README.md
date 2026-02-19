# VS Code PR Reviewer - Stage 1 Delivery

This repository now contains a stage-1 implementation of the pipeline:

`PR link -> GitHub context -> Jira key extraction -> Jira context -> score -> markdown draft`

## Scope implemented

- PR link parsing and validation (`github.com/{owner}/{repo}/pull/{number}`)
- Skill-based pipeline with orchestrator
- Required stage-1 skills:
  - `fetch-github-context`
  - `extract-jira-keys`
  - `fetch-jira-context`
  - `aggregate-context`
  - `score-pr`
  - `draft-comment`
- Config-driven thresholds and scoring weights
- Provider abstraction with mock providers
- Basic `views` and `security` contracts for next-stage integration
- Unit-test files for parser, skill behavior, scoring, and orchestrator flow

## Structure

- `src/orchestrator`: stage-1 flow orchestration
- `src/skills`: pluggable skills
- `src/providers`: external-system interfaces and mocks
- `src/domain`: core types
- `src/config`: config schema and defaults
- `src/utils`: parsing/extraction/scoring helpers
- `src/views`: panel message contracts
- `src/security`: secret storage abstraction
- `tests`: stage-1 unit and flow tests

## Configuration

`Stage1ReviewOrchestrator` supports partial config override.

Provider-related config now includes domain and credential:

- `providers.github.domain`
- `providers.github.credential`
- `providers.jira.domain`
- `providers.jira.credential`

Credential config shape:

- `mode`: `none | pat | oauth | basic | vscodeAuth`
- `tokenRef`: secret key name for token-like credentials
- `usernameRef`: secret key name for basic auth username
- `passwordRef`: secret key name for basic auth password

Example:

```ts
const orchestrator = new Stage1ReviewOrchestrator({
  githubProvider,
  jiraProvider,
  config: {
    providers: {
      github: {
        domain: "https://api.github.com",
        credential: { mode: "pat", tokenRef: "github_pat" }
      },
      jira: {
        domain: "https://acme.atlassian.net",
        credential: { mode: "basic", usernameRef: "jira_user", passwordRef: "jira_pass" }
      }
    }
  }
});
```

## Preparation

Before running with real providers in VS Code extension host, prepare:

1. VS Code extension runtime (for reading `workspace.getConfiguration`).
2. Workspace settings with provider domain and credential fields.
3. Recommended: store secrets in `SecretStorage`, then put secret keys (`tokenRef/usernameRef/passwordRef`) in settings.
4. Optional for local debugging only: set plain `token/username/password` in settings.

Settings example (`.vscode/settings.json`):

```json
{
  "prReviewer.providers.github.domain": "https://api.github.com",
  "prReviewer.providers.github.credential.mode": "pat",
  "prReviewer.providers.github.credential.tokenRef": "github_pat",

  "prReviewer.providers.jira.domain": "https://acme.atlassian.net",
  "prReviewer.providers.jira.credential.mode": "basic",
  "prReviewer.providers.jira.credential.usernameRef": "jira_user",
  "prReviewer.providers.jira.credential.passwordRef": "jira_pass"
}
```

Load config patch from VS Code settings:

```ts
import { loadStage1ConfigPatchFromVsCodeSettings, Stage1ReviewOrchestrator } from "./src/index.js";

const settingsPatch = await loadStage1ConfigPatchFromVsCodeSettings("prReviewer");
const orchestrator = new Stage1ReviewOrchestrator({
  githubProvider,
  jiraProvider,
  config: settingsPatch
});
```

## What is intentionally deferred to stage 2/3

- Confluence retrieval and relevance-ranking optimization
- Publish-comment flow and confirmation modal behavior
- Copilot runtime integration via `vscode.lm` in extension host
- Full VS Code webview/panel rendering and UX wiring
