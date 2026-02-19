# Stage 4 Delivery (VS Code Panel End-to-End Wiring)

## Delivered

1. Extension activation entry:
- `src/extension/extension.ts`

2. VS Code view/command contributions:
- activity bar container: `prReviewer`
- panel view: `prReviewer.panel`
- command: `prReviewer.openPanel`

3. Webview UI implementation:
- PR link input
- review profile selector
- additional keywords input
- run review action
- editable draft area
- publish action

4. Webview <-> extension host message wiring:
- inbound: `start-review`, `publish-review`
- outbound: `review-completed`, `publish-completed`, `review-failed`

5. Panel provider orchestration integration:
- invoke `Stage1ReviewOrchestrator.run`
- invoke `Stage1ReviewOrchestrator.publishEditedComment`

6. VS Code settings patch loading in panel runtime.
7. Demo-data switch in panel runtime:
- `prReviewer.providers.useDemoData=true` -> use demo providers
- `prReviewer.providers.useDemoData=false` -> use real HTTP providers
8. TLS validation switch for real-provider HTTPS calls:
- `prReviewer.providers.disableTlsValidation=true` -> disable certificate validation

9. Stage-4 tests:
- `tests/panelMessageRouter.test.ts`
- `tests/panelHtml.test.ts`

## Main Code Locations

- `src/extension/extension.ts`
- `src/extension/panelProvider.ts`
- `src/extension/panelMessageRouter.ts`
- `src/extension/panelHtml.ts`
- `package.json` (views/commands/activation/configuration)

## Current Boundary

The stage-4 panel supports both demo and real HTTP providers.
Provider quality and endpoint compatibility depend on target GitHub/Jira/Confluence environment configuration.
