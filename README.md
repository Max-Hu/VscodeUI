# VS Code PR Reviewer - Stage 3 Delivery

This repository now contains a stage-3 implementation of the pipeline:

`PR link -> GitHub context -> Jira key extraction -> Jira context -> Confluence context -> relevance aggregation -> score -> draft -> publish`

## Scope implemented

- PR link parsing and validation (`github.com/{owner}/{repo}/pull/{number}`)
- Skill-based pipeline with orchestrator
- Required skills:
  - `fetch-github-context`
  - `extract-jira-keys`
  - `fetch-jira-context`
  - `fetch-confluence-context`
  - `aggregate-context`
  - `score-pr`
  - `draft-comment`
  - `publish-comment`
- Config-driven thresholds and scoring weights
- Provider abstraction with mock providers
- Confluence retrieval strategy (strong-link first, then query expansion)
- Relevance ranking + topK truncation + Jira->Confluence traceability mapping
- Copilot LLM is the only scoring/evaluation engine (no local-rule scoring fallback)
- Publish confirmation gate and edited-text publish flow
- Pipeline observability events and degraded-mode warnings
- Unit-test files for parser, skill behavior, aggregation/ranking, scoring, publish, and orchestrator flow

## Structure

- `src/orchestrator`: stage-3 flow orchestration
- `src/skills`: pluggable skills
- `src/providers`: external-system interfaces and mocks
- `src/observability`: pipeline event observer interfaces
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
- `providers.confluence.domain`
- `providers.confluence.credential`

Credential config shape:

- `mode`: `none | pat | oauth | basic | vscodeAuth`
- `tokenRef`: secret key name for token-like credentials
- `usernameRef`: secret key name for basic auth username
- `passwordRef`: secret key name for basic auth password

Stage-3 runtime config:

- `llm.mode`: `copilot | mock`
- `post.enabled`: `true | false`
- `post.requireConfirmation`: `true | false`
- `resilience.continueOnConfluenceError`: `true | false`
- `observability.enabled`: `true | false`

Example:

```ts
const orchestrator = new Stage1ReviewOrchestrator({
  githubProvider,
  jiraProvider,
  confluenceProvider,
  config: {
    providers: {
      github: {
        domain: "https://api.github.com",
        credential: { mode: "pat", tokenRef: "github_pat" }
      },
      jira: {
        domain: "https://acme.atlassian.net",
        credential: { mode: "basic", usernameRef: "jira_user", passwordRef: "jira_pass" }
      },
      confluence: {
        domain: "https://acme.atlassian.net/wiki",
        credential: { mode: "oauth", tokenRef: "confluence_oauth" }
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
      enabled: true
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
  "prReviewer.providers.jira.credential.passwordRef": "jira_pass",

  "prReviewer.providers.confluence.domain": "https://acme.atlassian.net/wiki",
  "prReviewer.providers.confluence.credential.mode": "oauth",
  "prReviewer.providers.confluence.credential.tokenRef": "confluence_oauth",

  "prReviewer.llm.mode": "copilot",
  "prReviewer.post.enabled": true,
  "prReviewer.post.requireConfirmation": true,
  "prReviewer.resilience.continueOnConfluenceError": true,
  "prReviewer.observability.enabled": true
}
```

Prompt template hot reload (for local prompt editing):

- `PR_REVIEWER_PROMPT_HOT_RELOAD=true`
- optional `PR_REVIEWER_PROMPT_TEMPLATE_DIR=<absolute-path-to-templates>`

Load config patch from VS Code settings:

```ts
import { loadStage1ConfigPatchFromVsCodeSettings, Stage1ReviewOrchestrator } from "./src/index.js";

const settingsPatch = await loadStage1ConfigPatchFromVsCodeSettings("prReviewer");
const orchestrator = new Stage1ReviewOrchestrator({
  githubProvider,
  jiraProvider,
  confluenceProvider,
  config: settingsPatch
});
```

Publish edited comment:

```ts
const publishResult = await orchestrator.publishEditedComment({
  prLink: "https://github.com/acme/platform/pull/42",
  commentBody: "Edited markdown by human reviewer",
  confirmed: true
});
```

## What is intentionally deferred to stage 4+

- Full VS Code webview/panel rendering and UX wiring
