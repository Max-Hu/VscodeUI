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
- Verbose logs can be enabled via `prReviewer.observability.verboseLogs`.

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

- Default mode is `llm.mode = copilot`.
- Scoring and evaluation are done by Copilot output.
- Local rule-based scoring fallback is intentionally disabled.
- `mock` mode is available for testing and local development.
- You can use `prReviewer.llm.useMock` as a quick boolean switch (`true` -> `mock`, `false` -> `copilot`).
- In `mock` mode, the extension uses a built-in `MockLlmProvider` and does not require Copilot chat models.

## Provider Runtime Behavior

The stage-4 panel supports two runtime modes:

- `prReviewer.providers.useDemoData = true` (default): use built-in demo providers
- `prReviewer.providers.useDemoData = false`: use real HTTP providers

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
- Use launch profile `Debug PR Reviewer Extension (Copilot)` when `prReviewer.llm.mode=copilot`.
- Use launch profile `Debug PR Reviewer Extension (Isolated)` with `prReviewer.llm.mode=mock`.
- During review, the panel shows live progress lines (pipeline and step events), including LLM runtime info (provider/mode/model when available).
- Backend debug logs are written to Output channel `PR Reviewer` (`View -> Output`).
- With `prReviewer.observability.verboseLogs=true`, prompt/response previews sent to LLM are also logged (truncated for safety).

## Package, Install, and Use

### 1. Prerequisites

- VS Code `>= 1.96.0`
- Node.js `20.11.1`
- npm `10.2.4`
- For `llm.mode=copilot`: active GitHub Copilot in VS Code
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
2. For demo mode, set `prReviewer.providers.useDemoData=true`.
3. For real mode, set `prReviewer.providers.useDemoData=false`.
4. If real mode is used, configure provider domain and credentials.
5. If you use `tokenRef/usernameRef/passwordRef`, set matching environment variables before launching VS Code.
6. Open `PR Reviewer` from the activity bar.
7. Enter PR link, run review, edit draft, publish.

### 6. Optional: Internal TLS Environments

If your internal endpoints use self-signed certificates, you can disable TLS certificate validation in real-provider mode:

```json
{
  "prReviewer.providers.useDemoData": false,
  "prReviewer.providers.disableTlsValidation": true
}
```

Use this only in trusted environments.

## Configuration

All settings are under `prReviewer.*`.

### Provider Settings

- `prReviewer.providers.github.domain`
- `prReviewer.providers.github.credential.mode`
- `prReviewer.providers.github.credential.tokenRef`
- `prReviewer.providers.jira.domain`
- `prReviewer.providers.jira.credential.mode`
- `prReviewer.providers.jira.credential.tokenRef`
- `prReviewer.providers.jira.credential.usernameRef`
- `prReviewer.providers.jira.credential.passwordRef`
- `prReviewer.providers.confluence.domain`
- `prReviewer.providers.confluence.credential.mode`
- `prReviewer.providers.confluence.credential.tokenRef`
- `prReviewer.providers.useDemoData`
- `prReviewer.providers.disableTlsValidation`

### Runtime Switches

- `prReviewer.llm.mode` (`copilot` or `mock`)
- `prReviewer.llm.useMock` (`true` -> `mock`, `false` -> `copilot`; overrides `prReviewer.llm.mode` when set)
- `prReviewer.post.enabled`
- `prReviewer.post.requireConfirmation`
- `prReviewer.resilience.continueOnConfluenceError`
- `prReviewer.observability.enabled`
- `prReviewer.observability.verboseLogs`

### What Each `prReviewer` Setting Means

| Setting | Meaning | Default |
| --- | --- | --- |
| `prReviewer.providers.github.domain` | GitHub API base URL used in real-provider mode. | `https://api.github.com` |
| `prReviewer.providers.github.credential.mode` | Auth mode for GitHub (`none/pat/oauth/basic/vscodeAuth`). | `none` |
| `prReviewer.providers.github.credential.tokenRef` | Env var key name for GitHub token when mode is `pat` or `oauth`. | `""` |
| `prReviewer.providers.jira.domain` | Jira base URL used in real-provider mode. | `https://your-domain.atlassian.net` |
| `prReviewer.providers.jira.credential.mode` | Auth mode for Jira (`none/pat/oauth/basic/vscodeAuth`). | `none` |
| `prReviewer.providers.jira.credential.tokenRef` | Env var key name for Jira token when mode is `pat` or `oauth`. | `""` |
| `prReviewer.providers.jira.credential.usernameRef` | Env var key name for Jira username when mode is `basic`. | `""` |
| `prReviewer.providers.jira.credential.passwordRef` | Env var key name for Jira password when mode is `basic`. | `""` |
| `prReviewer.providers.confluence.domain` | Confluence base URL used in real-provider mode. | `https://your-domain.atlassian.net/wiki` |
| `prReviewer.providers.confluence.credential.mode` | Auth mode for Confluence (`none/pat/oauth/basic/vscodeAuth`). | `none` |
| `prReviewer.providers.confluence.credential.tokenRef` | Env var key name for Confluence token when mode is `pat` or `oauth`. | `""` |
| `prReviewer.providers.useDemoData` | `true`: use demo providers; `false`: use real HTTP providers. | `true` |
| `prReviewer.providers.disableTlsValidation` | Disable HTTPS certificate validation for real providers. Use only in trusted internal environments. | `false` |
| `prReviewer.llm.mode` | LLM execution mode for scoring/drafting (`copilot` or `mock`). | `copilot` |
| `prReviewer.llm.useMock` | Quick boolean switch for LLM mode. `true` forces `mock`, `false` forces `copilot`. Overrides `prReviewer.llm.mode` when provided. | unset |
| `prReviewer.post.enabled` | Enable/disable publishing comments back to PR. | `true` |
| `prReviewer.post.requireConfirmation` | Require explicit confirmation before publish. | `true` |
| `prReviewer.resilience.continueOnConfluenceError` | Continue pipeline with warning when Confluence retrieval fails. | `true` |
| `prReviewer.observability.enabled` | Emit pipeline/step observability events. | `true` |
| `prReviewer.observability.verboseLogs` | Print verbose debug logs (inbound/outbound payloads and raw pipeline events) to Output channel `PR Reviewer`. | `false` |

Notes:

- `tokenRef/usernameRef/passwordRef` currently resolve from environment variables whose names equal the `*Ref` values.
- `prReviewer.providers.disableTlsValidation` only affects real-provider mode (`prReviewer.providers.useDemoData=false`).

### Credential Modes

- `none`
- `pat`
- `oauth`
- `basic`
- `vscodeAuth`

### Example `.vscode/settings.json`

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
  "prReviewer.providers.confluence.credential.tokenRef": "confluence_token",
  "prReviewer.providers.useDemoData": true,
  "prReviewer.providers.disableTlsValidation": false,

  "prReviewer.llm.mode": "copilot",
  "prReviewer.llm.useMock": false,
  "prReviewer.post.enabled": true,
  "prReviewer.post.requireConfirmation": true,
  "prReviewer.resilience.continueOnConfluenceError": true,
  "prReviewer.observability.enabled": true,
  "prReviewer.observability.verboseLogs": true
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

- `prReviewer.providers.useDemoData=true` uses static demo data.
- `prReviewer.providers.useDemoData=false` uses HTTP APIs and requires valid domains/credentials.
- `prReviewer.providers.disableTlsValidation=true` disables HTTPS certificate validation in real-provider mode (use only in trusted internal environments).
- Credential `*Ref` values are resolved from environment variables in current implementation.
- For real environments, credentials should be stored in VS Code SecretStorage; direct credential fields are best for local/debug usage only.

## Troubleshooting

- Error: `LLM provider is required for score-pr...`
  - Set `"prReviewer.llm.useMock": true` to force built-in mock LLM, or
  - Set `"prReviewer.llm.useMock": false` (or `"prReviewer.llm.mode": "copilot"`) and ensure Copilot chat model is available.
- No logs in Output channel:
  - Open `View -> Output` in the Extension Development Host window and select channel `PR Reviewer`.
  - Ensure `"prReviewer.observability.enabled": true` if you want step-by-step pipeline events.
  - Set `"prReviewer.observability.verboseLogs": true` for detailed payload/event logs and auto-open Output panel on request.

## Related Documents

- `requirement/requirement.md`
- `requirement/plan.md`
- `requirement/stage1-delivery.md`
- `requirement/stage2-delivery.md`
- `requirement/stage3-delivery.md`
- `requirement/stage4-delivery.md`
