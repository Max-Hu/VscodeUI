# Implementation Plan

## 1. Goals and Boundaries

- Minimize user input: only PR link is mandatory.
- Close the loop: context aggregation -> scoring -> editable publishing.
- Keep architecture extensible for new providers and review dimensions.

## 2. System Design

- `views`: receive user input, display status/output, send panel events
- `orchestrator`: single workflow coordinator
- `skills`: independent, replaceable processing units
- `providers`: external data adapters (GitHub/Jira/Confluence)
- `llm`: model access abstraction
- `config` + `security`: runtime settings and secret references

## 3. End-to-End Workflow

1. User enters PR link (+ optional profile/keywords).
2. Validate and parse PR link.
3. Fetch GitHub context and trim large patches.
4. Extract Jira keys from commit messages.
5. Fetch Jira issue context.
6. Fetch Confluence context by strong links first, then query expansion.
7. Aggregate and rank context, build traceability map.
8. Request LLM scoring/evaluation.
9. Generate markdown draft.
10. User edits and confirms publishing.

## 4. Key Technical Decisions

- Skills pipeline for composability and testability.
- Traceability-first output (Jira -> Confluence mapping).
- Human confirmation gate for publishing.
- Config-driven thresholds and scoring weights.
- Resilience mode for optional Confluence degradation.

## 5. Quality and Validation Strategy

- Unit tests for parser, extraction, aggregation, scoring, publish logic.
- Orchestrator flow tests with mock providers and mock LLM.
- Prompt template tests and hot-reload tests.
- Stage-by-stage delivery docs for incremental acceptance.

## 6. Delivery Stages

- Stage 1: PR -> Jira -> score -> draft
- Stage 2: Confluence retrieval and relevance ranking
- Stage 3: publish flow, resilience, observability
- Stage 4: VS Code panel and message wiring
