export const SCORE_OUTPUT_SCHEMA =
  "{\"overallScore\":number(0-100),\"scoreBreakdown\":[{\"dimension\":\"Correctness|Maintainability|Reliability|Security|Performance|Test Quality|Traceability\",\"score\":number(0-100),\"weight\":number,\"rationale\":string}],\"evidence\":[{\"file\":string?,\"snippet\":string?}],\"confidence\":\"low|medium|high\"}";

export const DRAFT_OUTPUT_SCHEMA = "{\"markdown\":\"...\"}";
