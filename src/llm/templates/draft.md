Generate a PR review markdown draft for human editing.
Use concise sections: Summary, Score Breakdown, Jira/Confluence Traceability, Risks, Suggested Actions.
Return JSON only with this schema:
{{output_schema}}

Review profile: {{profile}}
Mandatory focus areas: Security, Performance, Compliance.

Context:
{{context_json}}
