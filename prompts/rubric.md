PR REVIEW RUBRIC (SONAR-LIKE BASELINE v1)

Goal:
Catch high-impact issues before merge, keep review concise, and approve only when basic quality gates pass.

How to classify findings:

- BLOCKER: must be fixed before merge (security/correctness/reliability risk).
- MAJOR: important issue; usually request changes.
- MINOR: improvement suggestion; should not block approval by itself.

Decision policy:

- decision = "REQUEST_CHANGES" if any BLOCKER exists.
- decision = "REQUEST_CHANGES" if 2 or more MAJOR issues exist.
- decision = "APPROVE" when there are no BLOCKER issues and fewer than 2 MAJOR issues.
- MINOR issues can be suggested while still approving.

Output discipline:

- Comment only on real, actionable issues.
- Avoid style-only nitpicks unless they impact maintainability or cause defects.
- Keep comments concise and specific.

---

## CATEGORY 1: CORRECTNESS & RELIABILITY

[COR-001] Null/undefined safety (BLOCKER)
Check newly added/changed logic for possible null/undefined dereference without guard.

[COR-002] Error handling integrity (BLOCKER)
No empty catch blocks, swallowed exceptions, or success response after failure.

[COR-003] Input validation for external data (BLOCKER)
All request/query/path/body/webhook inputs must be validated or sanitized before use.

[COR-004] Edge-case safety (MAJOR)
Check off-by-one, empty arrays/maps, boundary conditions, and missing default paths.

[COR-005] Contract compatibility (MAJOR)
No unintentional API behavior changes (status codes, response shape, required fields).

---

## CATEGORY 2: SECURITY

[SEC-001] Secrets exposure (BLOCKER)
No hardcoded credentials, tokens, private keys, or leaked env values in code/logs/tests.

[SEC-002] Injection vectors (BLOCKER)
Block string-concatenated SQL/commands/queries and unsafe dynamic evaluation.

[SEC-003] Broken auth/authz on sensitive paths (BLOCKER)
Sensitive endpoints/actions must enforce authentication and authorization checks.

[SEC-004] Path traversal / SSRF / unsafe URL usage (BLOCKER)
No unsanitized filesystem/network targets from user-controlled input.

[SEC-005] Unsafe output or reflective data handling (MAJOR)
Flag likely XSS or unsafe rendering/serialization behavior in changed code.

---

## CATEGORY 3: PERFORMANCE & SCALABILITY

[PER-001] N+1 query or repeated expensive I/O in loops (MAJOR)
Detect avoidable repeated DB/network/disk calls in iterative paths.

[PER-002] Blocking work in hot request path (MAJOR)
Detect sync I/O, CPU-heavy loops, or large payload work that should be deferred/streamed.

[PER-003] Unbounded operations (MAJOR)
No missing limits/pagination/timeouts/retries on potentially large or external operations.

[PER-004] Wasteful allocations or duplicate computation (MINOR)
Suggest optimization only when meaningful; do not block merge for tiny gains.

---

## CATEGORY 4: CONCURRENCY & ASYNC SAFETY

[CON-001] Async misuse (BLOCKER)
Missing await, unhandled promise rejection, or race-causing async sequencing bugs.

[CON-002] Shared state race risk (MAJOR)
Non-thread-safe/shared mutable state without synchronization or safe design.

[CON-003] Resource lifecycle correctness (MAJOR)
Connections/files/locks/timers are properly cleaned up on all control paths.

---

## CATEGORY 5: CODE HEALTH

[QLT-001] Dead/debug code in production paths (MAJOR)
No leftover debug logs, commented-out logic, unreachable blocks, or unused critical imports.

[QLT-002] Excessive complexity in changed code (MAJOR)
Large/complex function changes should be split/refactored when clarity is harmed.

[QLT-003] Missing tests for changed behavior (MAJOR)
New behavior, bug fixes, and critical branches should be covered by tests.

[QLT-004] Naming clarity for variables/functions/classes (MAJOR)
Flag unclear or misleading names when they materially reduce readability or increase defect risk.

[QLT-005] Naming consistency and minor readability polish (MINOR)
Suggest improvements for abbreviations, inconsistent naming style, and small readability cleanups.

[QLT-006] Comment quality and accuracy (MAJOR)
Flag missing, stale, or misleading comments where logic is non-obvious or comments contradict behavior.

[QLT-007] Excessive/noisy comments (MINOR)
Suggest removing redundant comments that restate obvious code without adding intent.

[QLT-008] Loop construct correctness and safety (BLOCKER)
Flag incorrect loop bounds, mutation-during-iteration bugs, missing termination conditions, or async-in-loop defects causing wrong behavior.

[QLT-009] Loop construct choice and efficiency (MAJOR)
Flag inappropriate loop usage that causes avoidable complexity/performance issues (e.g., nested loops where map/set lookup is expected, wrong iterator patterns).

[QLT-010] Loop readability improvements (MINOR)
Suggest clearer iteration style (`for...of`, array methods, extracted helper) when behavior is already correct.

---

## REVIEWER ENFORCEMENT NOTES

- If issue is BLOCKER: request changes.
- If issue is MAJOR:
  - request changes when impact is concrete and non-trivial.
  - otherwise keep as targeted feedback.
- If issue is MINOR: suggestion only, no forced rejection.
- Do not duplicate comments for the same root cause.
- Prefer one strong comment over many weak comments.
