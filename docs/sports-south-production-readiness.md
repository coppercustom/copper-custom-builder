# Sports South integration — production-readiness architecture

Status: **DESIGN ONLY / NOT APPROVED FOR PRODUCTION**. Last reviewed: 2026-11-19.

## Verified baseline
The existing manually dispatched GitHub Actions workflow `.github/workflows/sports-south-soap-test.yml` performs read-only SOAP pagination, reconciliation, and synthetic fault-injection checks. The latest reviewed run reported 12/12 integrity checks and 8/8 synthetic checks passing, 1,640 unique records across two pages, and zero database writes. Synthetic checks **do not** prove database transaction safety.

## Non-negotiable controls
- Do not enable supplier catalog writes, automatic scheduling, or checkpoint advancement without a separately approved implementation and live transaction test plan.
- Preserve supplier pricing exclusion and do not log credentials, raw supplier records, or sensitive account identifiers.
- Keep source-specific staging distinct from the customer-facing unified catalog.
- Treat identifier overlaps and manufacturer conflicts as review flags, not verified product identity.

## Transaction boundary design
1. A synchronization attempt gets an immutable run ID and a frozen request window.
2. Every page is fetched and validated before any persistent change is considered.
3. The proposed batch, its digest, and reconciliation totals are computed deterministically.
4. In a future separately approved implementation, staged changes and a corresponding checkpoint must commit atomically inside one database transaction. If any validation or write fails, neither the batch nor checkpoint may become visible.
5. A checkpoint must represent the **last fully committed window**, never the latest requested page or a partially completed run.
6. Concurrency control must prevent two attempts from committing the same window independently.

## Idempotency and restart contract
- Replaying an identical run/window should yield the same digest and no unintended additional effects.
- A run with a different digest for the same window is a conflict requiring review.
- Interrupted requests may be retried only after checking durable committed state.
- Network success or a local in-memory simulation is not evidence that a transaction committed.
- A restart must use the durable checkpoint, not a temporary GitHub Actions file.

## Fault and security test matrix
| Scenario | Expected behavior | Evidence still required |
|---|---|---|
| Malformed SOAP/XML | Abort without state changes | Live read-only parser test passed; production transaction untested |
| Duplicate/blank identifiers | Reject ambiguous input | Synthetic test passed |
| Full page at pagination safety cap | Fail closed | Bounded pagination implemented; production handling untested |
| Failed batch write | Roll back batch and checkpoint together | Real transactional test required |
| Lost connection after commit | Read durable state before retry | Real transactional test required |
| Concurrent runs | Exactly one effective commit per window | Database concurrency test required |
| Replay identical window | No unintended new effects | Synthetic test passed; database test required |
| Mismatched digest | Stop and flag conflict | Database test required |
| Unauthorized caller | No access to privileged write operation | Permission test required |
| Secret exposure in logs | No credential leakage | Automated log inspection recommended |

## Release gates (currently NOT met)
- [x] Read-only pagination and reconciliation checks passing
- [x] Synthetic failure/replay checks passing
- [ ] Transactional staging + checkpoint implementation reviewed
- [ ] Rollback and lost-acknowledgement tests against an isolated test database
- [ ] Concurrency and authorization tests against an isolated test database
- [ ] Data-quality conflicts dispositioned
- [ ] Monitoring, alerting, rollback and runbook approved
- [ ] Explicit authorization to enable production synchronization

## Operations and rollback
Maintain a sanitized run summary with request window, run ID, digest, counts, duration, failure category, and checkpoint before/after. Alert on repeated failures, unusual counts, and stale checkpoints. Rollback must be based on a tested database recovery procedure; resetting a cursor alone is not a safe rollback. Restrict write credentials to the minimum privilege required and never expose them to the browser.

## Next permitted action
Review this design and, if desired, build a **separate isolated test harness** for generic transaction/checkpoint behavior. Keep the verified supplier audit workflow unchanged and read-only.
