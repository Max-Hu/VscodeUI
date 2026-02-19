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

## Package, Install, and Use

### 1. Prerequisites

- VS Code `>= 1.96.0`
- Node.js `>= 20` (recommended)
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
- `prReviewer.post.enabled`
- `prReviewer.post.requireConfirmation`
- `prReviewer.resilience.continueOnConfluenceError`
- `prReviewer.observability.enabled`

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
| `prReviewer.post.enabled` | Enable/disable publishing comments back to PR. | `true` |
| `prReviewer.post.requireConfirmation` | Require explicit confirmation before publish. | `true` |
| `prReviewer.resilience.continueOnConfluenceError` | Continue pipeline with warning when Confluence retrieval fails. | `true` |
| `prReviewer.observability.enabled` | Emit pipeline/step observability events. | `true` |

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
  "prReviewer.post.enabled": true,
  "prReviewer.post.requireConfirmation": true,
  "prReviewer.resilience.continueOnConfluenceError": true,
  "prReviewer.observability.enabled": true
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

## Related Documents

- `requirement/requirement.md`
- `requirement/plan.md`
- `requirement/stage1-delivery.md`
- `requirement/stage2-delivery.md`
- `requirement/stage3-delivery.md`
- `requirement/stage4-delivery.md`
