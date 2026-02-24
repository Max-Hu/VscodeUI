# VS Code PR Reviewer

VS Code PR Reviewer is an extension-oriented project that turns a single Pull Request link into a structured review workflow.
It collects context from GitHub, Jira, and Confluence, asks VS Code Copilot to score and evaluate the change, generates an editable draft comment, and supports confirmed publishing.

## Objectives

- Minimal input: only a PR link is required.
- Context aggregation: combine GitHub, Jira, and Confluence signals.
- Explainable review output: score, per-dimension breakdown, evidence, confidence.
- Human-in-the-loop publishing: edit before publish and require confirmation.
- Extensible architecture: skills pipeline + provider abstractions.

## Current Stage Status

- Stage 1: Done (PR parsing, Jira extraction, scoring, draft)
- Stage 2: Done (Confluence retrieval, ranking, traceability)
- Stage 3: Done (publish flow, resilience, observability)
- Stage 4: Done (full VS Code Webview panel wiring)

## End-to-End Flow

`PR Link -> GitHub Context -> Jira Keys -> Jira Context -> Confluence Context -> Aggregate -> Score -> Draft -> Publish`

## Data Collection and Context Strategy

### 1. GitHub Context Collection

- Input starts from a single PR link (`owner/repo/pull/number`).
- The pipeline fetches PR metadata, changed files, commits, checks, and comments.
- File patches are trimmed by `maxFiles` and `maxPatchCharsPerFile` to keep prompt size controllable.
- Basic signals are extracted from PR text and comments:
  - Confluence-like links
  - Keywords for later Confluence query expansion

### 2. Jira Key Extraction Strategy

- Jira keys are extracted using configurable regex (`jiraKeyPattern`).
- Matching is case-insensitive in runtime behavior.
- Scan scope includes:
  - PR title
  - Base branch and head branch
  - PR comments
  - Commit messages
- Results are normalized to uppercase, deduplicated, and sorted.
- If no key is found, the pipeline fails early for traceability safety.

### 3. Jira Context Collection

- Requested keys are sent to Jira provider with `expandDepth`.
- The real Jira adapter expands linked issues (parent/subtasks/issue links) up to depth limit.
- For each issue, normalized fields include:
  - `key`, `summary`, `description`
  - `acceptanceCriteria`, `nfr`, `risks`, `testingRequirements`
  - `links` (from issue text URLs + Jira remote links)

### 4. Confluence Context Collection

- Strong-link retrieval runs first using links from:
  - Jira issue links
  - PR-side Confluence links
- Only Confluence links are accepted for direct retrieval; non-Confluence links are ignored.
- Direct retrieval resolves page id from URL and fetches page content from Confluence REST API (`body.storage`), then converts HTML to plain text.

### 5. Confluence Query Expansion (Search Completion)

- To improve recall beyond direct links, search queries are generated from:
  - `jiraContext.requestedKeys`
  - `jiraContext.issues[].summary`
  - `jiraContext.issues[].acceptanceCriteria`
  - GitHub extracted keywords
- Queries are deduplicated and filtered (`length >= 3`), then limited by `topK`.
- `searchPages(query)` is executed per query; results are tagged by source (`jira-query` or `keyword-query`).
- Direct and search results are merged and deduplicated by page url/id.

### 6. Aggregation and Traceability

- Confluence pages are scored for relevance using:
  - source type boost
  - strong-link boost
  - Jira key match count
  - keyword match count
- Top-ranked pages are kept (`topK`).
- Traceability map is built: `jiraKey -> confluenceUrls`.
- The final normalized review context includes GitHub + Jira + Confluence + traceability.

### 7. Resilience and Observability

- If Confluence retrieval fails and `continueOnConfluenceError=true`, the pipeline degrades gracefully with warnings.
- Runtime progress emits step-level events and summaries (including key fetched counts and LLM runtime info).
- Verbose logs can be enabled via `prReviewer.config.observability.verboseLogs`.

## Architecture

- `src/extension`: extension activation, panel provider, webview HTML, message routing
- `src/orchestrator`: workflow orchestration
- `src/skills`: pluggable business steps
- `src/providers`: data source interfaces and implementations
- `src/llm`: Copilot provider and prompt rendering
- `src/config`: defaults, schema, VS Code settings mapping
- `src/views`: panel message contracts
- `src/domain`: core domain models
- `tests`: unit and integration-style flow tests

## LLM Strategy

- Default mode is `prReviewer.config.llm.mode = copilot`.
- Scoring and evaluation are done by Copilot output.
- Local rule-based scoring fallback is intentionally disabled.
- `mock` mode is available for testing and local development.
- In `mock` mode, the extension uses a built-in `MockLlmProvider` and does not require Copilot chat models.

## Provider Runtime Behavior

The stage-4 panel supports two runtime modes:

- `prReviewer.config.providers.useDemoData = true` (default): use built-in demo providers
- `prReviewer.config.providers.useDemoData = false`: use real HTTP providers

Demo mode providers:

- `DemoGithubProvider`
- `DemoJiraProvider`
- `DemoConfluenceProvider`

Real mode providers:

- `GithubRestProvider`
- `JiraRestProvider`
- `ConfluenceRestProvider`

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Build

```bash
npm run build
```

3. Run tests

```bash
npm test
```

4. Debug in VS Code

- Open this repository in VS Code.
- Press `F5` to launch the Extension Development Host.
- Open the `PR Reviewer` activity-bar view.
- Run review with a PR link, edit the draft, and publish.
- Use launch profile `Debug PR Reviewer Extension (Copilot)` when `prReviewer.config.llm.mode=copilot`.
- Use launch profile `Debug PR Reviewer Extension (Isolated)` with `prReviewer.config.llm.mode=mock`.
- During review, the panel shows live progress lines (pipeline and step events), including LLM runtime info (provider/mode/model when available).
- Backend debug logs are written to Output channel `PR Reviewer` (`View -> Output`).
- With `prReviewer.config.observability.verboseLogs=true`, prompt/response previews sent to LLM are also logged (truncated for safety).

## Package, Install, and Use

### 1. Prerequisites

- VS Code `>= 1.96.0`
- Node.js `20.11.1`
- npm `10.2.4`
- For `prReviewer.config.llm.mode=copilot`: active GitHub Copilot in VS Code
- For packaging: `@vscode/vsce`

### 2. Prepare for Packaging

1. Ensure dependencies are installed:

```bash
npm install
```

2. Build the extension:

```bash
npm run build
```

3. Ensure `package.json` contains valid extension metadata for packaging (especially `publisher`).

### 3. Build a VSIX Package

Use one of the following:

```bash
npx @vscode/vsce package --out pr-reviewer.vsix
```

or

```bash
vsce package --out pr-reviewer.vsix
```

The output file (for example `pr-reviewer.vsix`) is your installable package.

### 4. Install the VSIX

Option A: VS Code UI

1. Open Extensions view.
2. Click `...` (top-right menu).
3. Select `Install from VSIX...`.
4. Choose `pr-reviewer.vsix`.

Option B: Command line

```bash
code --install-extension pr-reviewer.vsix --force
```

### 5. Configure and Use

1. Open workspace settings (`.vscode/settings.json`).
2. Configure `prReviewer.config` (structured JSON object).
3. For demo mode, set `prReviewer.config.providers.useDemoData=true`.
4. For real mode, set `prReviewer.config.providers.useDemoData=false`.
5. If real mode is used, configure provider domains and credentials.
6. Set provider tokens in `token` or `tokenRef` (both are treated as direct token values in current implementation).
7. Open `PR Reviewer` from the activity bar.
8. Enter PR link, run review, edit draft, publish.

Important:

- Legacy flat settings under `prReviewer.*` (for example `prReviewer.llm.mode`) are no longer read.
- Only `prReviewer.config` is supported.

### 6. Optional: Internal TLS Environments

If your internal endpoints use self-signed certificates, you can disable TLS certificate validation in real-provider mode:

```json
{
  "prReviewer.config": {
    "providers": {
      "useDemoData": false,
      "disableTlsValidation": true
    }
  }
}
```

Use this only in trusted environments.

## Configuration

All settings are under `prReviewer.config`.

### Credential Rules (This Build)

- `GitHub` only supports `token` (or `tokenRef`)
- `Jira` only supports `token` (or `tokenRef`)
- `Confluence` only supports `token` (or `tokenRef`)
- Supported domain shapes in this build:
- `GitHub`: `https://{host}/api/v3`
- `Jira`: `https://{host}/jira` (or `.../jira/rest/api/2`)
- `Confluence`: `https://{host}/confluence` (or `.../confluence/rest/api`)

### What Each `prReviewer.config` Setting Means

| Setting | Meaning | Default |
| --- | --- | --- |
| `prReviewer.config.providers` | Container for provider runtime switches and provider connection settings. | `{}` |
| `prReviewer.config.providers.useDemoData` | `true`: use built-in demo providers; `false`: use real HTTP providers. | `true` |
| `prReviewer.config.providers.disableTlsValidation` | Disable HTTPS certificate validation for real providers. Use only in trusted internal environments. | `false` |
| `prReviewer.config.providers.github` | GitHub provider configuration container. | `{}` |
| `prReviewer.config.providers.github.domain` | GitHub API base URL used in real-provider mode. Must match `https://{host}/api/v3`. | `https://alm-github.test/api/v3` |
| `prReviewer.config.providers.github.credential` | GitHub credential container. Only token fields are supported. | `{}` |
| `prReviewer.config.providers.github.credential.tokenRef` | GitHub token value (legacy field name; treated same as `token`). | `""` |
| `prReviewer.config.providers.github.credential.token` | Direct GitHub token (prefer `tokenRef`). | `""` |
| `prReviewer.config.providers.jira` | Jira provider configuration container. | `{}` |
| `prReviewer.config.providers.jira.domain` | Jira base URL used in real-provider mode. Must match `https://{host}/jira` or `.../jira/rest/api/2`. | `https://alm-jira.test/jira` |
| `prReviewer.config.providers.jira.credential` | Jira credential container. Only token fields are supported. | `{}` |
| `prReviewer.config.providers.jira.credential.tokenRef` | Jira token value (legacy field name; treated same as `token`). | `""` |
| `prReviewer.config.providers.jira.credential.token` | Direct Jira token (prefer `tokenRef`). | `""` |
| `prReviewer.config.providers.confluence` | Confluence provider configuration container. | `{}` |
| `prReviewer.config.providers.confluence.enableExpandedSearch` | Enable query-based Confluence expanded search. Default `false`. When disabled, only direct links with resolvable page IDs are fetched. | `false` |
| `prReviewer.config.providers.confluence.domain` | Confluence base URL used in real-provider mode. Must match `https://{host}/confluence` or `.../confluence/rest/api`. | `https://alm-confluence.test/confluence` |
| `prReviewer.config.providers.confluence.credential` | Confluence credential container. Only token fields are supported. | `{}` |
| `prReviewer.config.providers.confluence.credential.tokenRef` | Confluence token value (legacy field name; treated same as `token`). | `""` |
| `prReviewer.config.providers.confluence.credential.token` | Direct Confluence token (prefer `tokenRef`). | `""` |
| `prReviewer.config.llm` | LLM runtime configuration container. | `{}` |
| `prReviewer.config.llm.mode` | LLM execution mode for scoring/drafting (`copilot` or `mock`). | `copilot` |
| `prReviewer.config.post` | Publish behavior configuration container. | `{}` |
| `prReviewer.config.post.enabled` | Enable/disable publishing comments back to PR. | `true` |
| `prReviewer.config.post.requireConfirmation` | Require explicit confirmation before publish. | `true` |
| `prReviewer.config.resilience` | Failure tolerance configuration container. | `{}` |
| `prReviewer.config.resilience.continueOnConfluenceError` | Continue pipeline with warning when Confluence retrieval fails. | `true` |
| `prReviewer.config.observability` | Logging and observability configuration container. | `{}` |
| `prReviewer.config.observability.enabled` | Emit pipeline/step observability events. | `true` |
| `prReviewer.config.observability.verboseLogs` | Print verbose debug logs (inbound/outbound payloads and raw pipeline events) to Output channel `PR Reviewer`. | `false` |

Notes:

- `tokenRef` is treated as a direct token value (legacy field name); it is not resolved from environment variables.
- `prReviewer.config.providers.disableTlsValidation` only affects real-provider mode (`prReviewer.config.providers.useDemoData=false`).
- `prReviewer.config.providers.confluence.enableExpandedSearch=false` (default) disables query-based Confluence search. In this mode, Confluence content is fetched only from direct links with resolvable page IDs.
- Prefer `*Ref` fields over direct credentials in `settings.json`.

### Example `.vscode/settings.json`

```json
{
  "prReviewer.config": {
    "providers": {
      "useDemoData": false,
      "disableTlsValidation": false,
      "github": {
        "domain": "https://alm-github.test/api/v3",
        "credential": {
          "tokenRef": "github_token"
        }
      },
      "jira": {
        "domain": "https://alm-jira.test/jira",
        "credential": {
          "tokenRef": "jira_token"
        }
      },
      "confluence": {
        "enableExpandedSearch": false,
        "domain": "https://alm-confluence.test/confluence",
        "credential": {
          "tokenRef": "confluence_token"
        }
      }
    },
    "llm": {
      "mode": "copilot"
    },
    "post": {
      "enabled": true,
      "requireConfirmation": true
    },
    "resilience": {
      "continueOnConfluenceError": true
    },
    "observability": {
      "enabled": true,
      "verboseLogs": true
    }
  }
}
```

## Prompt Templates and Hot Reload

Templates:

- `src/llm/templates/score.md`
- `src/llm/templates/draft.md`

Hot reload environment variables:

- `PR_REVIEWER_PROMPT_HOT_RELOAD=true`
- Optional: `PR_REVIEWER_PROMPT_TEMPLATE_DIR=<absolute-template-dir>`

## Test Coverage

Current tests cover:

- PR URL parsing
- Jira key extraction
- Confluence retrieval and aggregation
- scoring and draft generation
- publish confirmation and publish behavior
- orchestrator end-to-end flow with mocks
- panel message routing and webview markup
- VS Code settings -> config patch mapping

## Main Entry Points

- Extension activation: `src/extension/extension.ts`
- Panel provider: `src/extension/panelProvider.ts`
- Panel message routing: `src/extension/panelMessageRouter.ts`
- Orchestrator: `src/orchestrator/reviewOrchestrator.ts`
- Copilot provider: `src/llm/copilotLlmProvider.ts`

## Known Boundaries

- `prReviewer.config.providers.useDemoData=true` uses static demo data.
- `prReviewer.config.providers.useDemoData=false` uses HTTP APIs and requires valid domains/credentials.
- `prReviewer.config.providers.disableTlsValidation=true` disables HTTPS certificate validation in real-provider mode (use only in trusted internal environments).
- `tokenRef` is treated as a direct token value in current implementation (no environment variable lookup).
- For real environments, credentials should be stored in VS Code SecretStorage; direct credential fields are best for local/debug usage only.

## Troubleshooting

- Error: `LLM provider is required for score-pr...`
  - Set `"prReviewer.config.llm.mode": "mock"` to force built-in mock LLM, or
  - Set `"prReviewer.config.llm.mode": "copilot"` and ensure Copilot chat model is available.
- No logs in Output channel:
  - Open `View -> Output` in the Extension Development Host window and select channel `PR Reviewer`.
  - Ensure `"prReviewer.config.observability.enabled": true` if you want step-by-step pipeline events.
  - Set `"prReviewer.config.observability.verboseLogs": true` for detailed payload/event logs and auto-open Output panel on request.

## Related Documents

- `requirement/requirement.md`
- `requirement/plan.md`
- `requirement/stage1-delivery.md`
- `requirement/stage2-delivery.md`
- `requirement/stage3-delivery.md`
- `requirement/stage4-delivery.md`


