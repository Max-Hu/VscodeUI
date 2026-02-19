# Stage 1 Delivery (PR -> Jira -> Score -> Draft)

## Delivered

1. PR link parsing and validation for GitHub pull request URLs.
2. GitHub context retrieval (metadata/files/commits/checks/comments) with patch trimming.
3. Jira key extraction from commit messages (configurable regex, deduplicate + sort).
4. Jira context retrieval and ReviewContext construction.
5. Structured scoring output:
- overall score
- breakdown by dimensions
- evidence
- confidence
6. Markdown draft generation for reviewer editing.
7. Provider domain and credential config shape introduced for GitHub/Jira.

## Main Code Locations

- Orchestrator: `src/orchestrator/reviewOrchestrator.ts`
- Skills: `src/skills/*.ts`
- Provider contracts/mocks: `src/providers/**/*.ts`
- Config/defaults: `src/config/*.ts`
- Domain models: `src/domain/types.ts`
- Tests: `tests/*.test.ts`
- Demo script: `examples/stage1-demo.ts`

## Not Included in Stage 1

1. Confluence expansion and relevance ranking (Stage 2).
2. Publish confirmation and final publish flow (Stage 3).
3. Full VS Code Webview panel runtime wiring (Stage 4).
