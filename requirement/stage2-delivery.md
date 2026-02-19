# Stage 2 Delivery (Confluence Retrieval and Relevance Optimization)

## Delivered

1. New `fetch-confluence-context` skill:
- strong-link retrieval first (Jira issue links + PR links)
- query expansion fallback (Jira keys, summaries, AC, keywords)
- deduplicated page set

2. Upgraded `aggregate-context` skill:
- Confluence page relevance scoring
- sorting and truncation by `topK`
- Jira -> Confluence traceability mapping

3. Scoring and draft upgrades:
- traceability dimension now reflects Confluence coverage
- draft now includes Confluence context and mapping sections

4. Config extension:
- `providers.confluence.domain`
- `providers.confluence.credential.*`
- VS Code settings mapping for Confluence fields

## Main Code Locations

- Confluence provider contract: `src/providers/confluenceProvider.ts`
- Confluence mock provider: `src/providers/mocks/mockConfluenceProvider.ts`
- Confluence skill: `src/skills/fetchConfluenceContextSkill.ts`
- Aggregation updates: `src/skills/aggregateContextSkill.ts`
- Orchestrator updates: `src/orchestrator/reviewOrchestrator.ts`
- VS Code settings mapping: `src/config/vscodeSettings.ts`

## Added Tests

- `tests/fetchConfluenceContextSkill.test.ts`
- `tests/aggregateContextSkill.test.ts`
- `tests/reviewOrchestrator.test.ts` (Confluence path)
- `tests/vscodeSettings.test.ts` (Confluence config mapping)
