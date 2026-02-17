REVIEW COMMENT TEMPLATE (STRUCTURED)

Use this exact structure for each finding:

{
"rule_id": "<rubric id: COR-003 | SEC-002 | PER-001 | ...>",
"severity": "<BLOCKER | MAJOR | MINOR>",
"approval_impact": "<request_changes | approve_with_suggestion>",
"title": "<short issue title>",
"why": "<why this matters: user/system impact and risk>",
"evidence": "<what in the current diff/code shows this issue>",
"how_to_fix": "<1-2 concrete remediation steps>",
"fix_example": "<optional tiny code hint/snippet>",
"confidence": "<high | medium | low>"
}

Field guidance:

- `rule_id` must match an id from `prompts/rubric.md`.
- `severity` must be exactly one of `BLOCKER`, `MAJOR`, `MINOR`.
- `approval_impact` mapping:
  - `BLOCKER` -> `request_changes`
  - `MAJOR` -> usually `request_changes` when impact is concrete; otherwise `approve_with_suggestion`
  - `MINOR` -> `approve_with_suggestion`
- `title` should be a short, descriptive title for the issue.
- `why` explains impact (correctness/security/performance/maintainability), not style preference.
- `evidence` must be specific to changed code.
- `how_to_fix` should be actionable and short.
- `fix_example` is optional but recommended for complex issues.
- `confidence` should be one of `high`, `medium`, or `low`.
- Keep each comment concise and avoid praise/filler.

Compact text format (if JSON is not needed):
[RULE_ID][SEVERITY][approval_impact=<request_changes|approve_with_suggestion>] <short title>
Why: <impact/risk in one sentence>.
Evidence: <exact behavior/pattern in changed code>.
How: <concrete fix steps>.

Example:
{
"rule_id": "SEC-002",
"severity": "BLOCKER",
"approval_impact": "request_changes",
"title": "SQL query built using string interpolation",
"why": "User-controlled input can inject SQL and read or modify protected data.",
"evidence": "The query string concatenates req.body.id directly into SQL.",
"how_to_fix": "Use parameterized queries and pass user input as bound parameters.",
"fix_example": "db.query('SELECT \* FROM t WHERE id = ?', [req.body.id])",
"confidence": "high"
}
