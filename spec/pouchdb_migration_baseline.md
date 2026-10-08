# Browser PouchDB migration: inventory and baseline

Tracks [issue #647](https://github.com/walterra/eddoapp/issues/647).

## Scope

Keep CouchDB and TanStack Query. Replace browser PouchDB with authenticated Hono APIs.
Remove durable offline writes and browser replication. Add Redux only for concrete shared UI-state requirements.

This document inventories dependencies and defines measurements. It does not establish a performance root cause.

## Dependency inventory

Paths below are relative to `packages/web-client/src/`.

| Area                | Current entry points                                                                        | Replacement boundary                                                 |
| ------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Database lifecycle  | `pouch_db.ts`, `pouch_db_types.ts`, `eddo.tsx`                                              | Session-scoped API client and query-cache cleanup                    |
| Safe operations     | `api/safe-db-operations.ts`, `api/safe-db-operations-with-health.ts`                        | Typed HTTP errors, cancellation, revision-aware writes               |
| Database setup      | `database_setup.ts`, `database_setup_helpers.ts`, `components/todo_board_state.ts`          | Server-owned design documents and indexes                            |
| Schema migration    | `components/todo_migration.ts`, `components/todo_board_state.ts`                            | Server migration preserving alpha4 scheduled fields                  |
| Date-range reads    | `hooks/use_todos_by_date_range.ts`                                                          | Bounded todo list endpoint and adjacent-range prefetch               |
| Activities          | `hooks/use_activities_by_week.ts`                                                           | Timezone-aware activity range endpoint                               |
| Active timers       | `hooks/use_time_tracking_active.ts`                                                         | Active-timer endpoint                                                |
| Relationships       | `hooks/use_parent_child.ts`, `hooks/use_expanded_children.ts`                               | Detail, batched children, and subtask-count endpoints                |
| Contexts and tags   | `hooks/use_eddo_contexts.ts`, `hooks/use_tags.ts`                                           | Server aggregate endpoints                                           |
| Detail hydration    | `hooks/use_todo_flyout.tsx`, `components/audit_sidebar.tsx`                                 | Todo detail endpoint                                                 |
| Todo writes         | `hooks/use_todo_mutations.ts`                                                               | Create, revision-safe patch, delete, completion, and timer endpoints |
| Audited writes      | `hooks/use_audited_todo_mutations.ts`                                                       | Preserve audit semantics while moving writes server-side             |
| Bulk writes         | `hooks/use_bulk_todo_mutation.ts`                                                           | Batch endpoint with per-document results                             |
| Todo replication    | `hooks/use_couchdb_sync.ts`, `hooks/use_couchdb_sync_helpers.ts`                            | One authenticated changes consumer per session                       |
| Cache freshness     | `hooks/use_database_changes.tsx`, `hooks/use_recent_mutations.ts`, `config/query_client.ts` | Targeted reconciliation and reconnect recovery                       |
| Aggregate freshness | `hooks/use_eddo_contexts.ts`, `hooks/use_tags.ts`                                           | Explicit context/tag reconciliation; audit their separate listeners  |
| Attachments         | `hooks/use_attachment.ts`, `components/attachment_image.tsx`, `hooks/use_couchdb_sync.ts`   | On-demand authenticated binary transfer and metadata                 |
| View integration    | `components/todo_board.tsx`, `components/todo_table.tsx`, `components/todo_graph.tsx`       | API-backed hooks without raw database access                         |
| Health and status   | `hooks/use_database_health.ts`, `components/page_wrapper.tsx`, database error components    | Connection/request status instead of replication health              |
| Telemetry           | `telemetry/spans.ts`                                                                        | Query, mutation, reconciliation, and connection spans                |
| Test infrastructure | `test-setup.ts`, `test-utils.tsx`, `test-polyfill.ts`, PouchDB-related tests                | API mocks plus CouchDB integration tests                             |

Audit indirect callers of these entry points before deleting them. Search-only counts do not establish a complete call graph.
Keep server-side database adapters where required.

## Existing performance-sensitive behavior

- Date-range queries request up to 10,000 alpha4 documents and prefetch adjacent ranges.
- Activity queries fetch up to 10,000 todos with nonempty activity, then expand and filter entries in the browser.
- Active-timer queries request up to 10,000 documents before selecting active timers.
- Parent-child queries cap some results at 100; aggregate counts request up to 10,000 documents.
- External changes debounce for 150 ms, then invalidate all todo and activity queries.
- Contexts and tags maintain additional change-driven invalidation paths.
- Initialization creates local design documents and indexes. Visible-range migration gates reads; background migration also writes locally.
- Both todo and attachment databases use live replication. Local databases enable automatic compaction.
- The query client uses infinite stale time and disables focus/reconnect refetching.
- Existing update hooks fetch the current revision and save an edited full document. Review lost-update behavior before moving this pattern server-side.
- The existing database proxy buffers response bodies. Bounded long polling avoids assuming SSE passthrough works.

These are candidate costs, not measured bottlenecks. React rendering, graph layout, server latency, and migration activity require separate attribution.

## Evidence collected

- Inspected checkout: commit `5eae4a3d`, branch `20261005-remove-pouchdb`.
- Existing `spec/couchdb-sync-performance-issue.md` reports historical 2.6-second delays. It lacks a reproducible trace and is not a current baseline.
- Existing development logs show completed todo/attachment proxy requests around 8–15 ms in the sampled tail.
  These timings exclude browser query/render work and do not describe long-poll latency.
- Logs also show repeated `GET /api/` responses with HTTP 401. Attribute these requests before treating them as performance evidence.
- An isolated browser reached `http://localhost:3000/` and displayed the sign-in page.
- Profiled walterra read-only and retained aggregates only. No account data was edited or local databases cleared.
- Completed 368 headed day-paging measurements with 9,899 calibrated synthetic todos in disposable browser sessions.
  Real-account UI measurements remain uncollected; the baseline represents the calibrated workload.

## Repeatable benchmark protocol

### Environment

Record commit, browser/version, OS/hardware, viewport, account, document/attachment counts,
visible date range, view, filter settings, build mode, throttling, and sync state.
Use the same environment before and after migration. Report development and production runs separately.

Use an authenticated test account with representative data. Never clear the user's browser storage.
Use disposable browser profiles for first-sync tests. Keep authentication artifacts and traces containing private data outside version control.

### Scenarios

Run each scenario five times; report median, maximum, and individual samples.
Do not present five samples as a reliable p95 estimate.

| Scenario                 | Procedure                                                  | Primary measurements                                           |
| ------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------- |
| First synchronization    | Sign in with a disposable profile and empty local database | Time to usable board, sync catch-up, bytes, long tasks         |
| Warm-local startup       | Reload with populated local database and cold query cache  | Time to usable board, initialization/migration/query costs     |
| Uncached week navigation | Navigate to a week outside prefetched ranges               | Input-to-correct-content time, query duration, render duration |
| Cached navigation        | Return to a previously loaded week                         | Input-to-content time, requests, render duration               |
| Completion               | Toggle a dedicated nonrepeating test todo and restore it   | Optimistic feedback, local persistence, remote acknowledgement |
| Timer                    | Start/stop a dedicated test todo timer                     | Feedback, persistence, activity-query work                     |
| External update          | Change one test todo through an approved second client     | Event-to-visible latency, affected queries, requests           |
| Idle                     | Observe the board for 60 seconds after catch-up            | CPU/long tasks, requests, background database work             |
| Extended navigation      | Visit 20 weeks, then return to the starting view           | Heap trend, cache entries, local storage, refetch counts       |
| Graph comparison         | Repeat reads in board and graph with identical filters     | Separate query latency from layout/render cost                 |

Completion and timer scenarios create audit/history effects even when the visible value is restored.
Use designated test documents, not ordinary account tasks.

### Instrumentation

1. Record a Chromium Performance trace covering one scenario, not an entire browsing session.
2. Capture navigation/paint timings separately from authenticated time-to-usable-board.
3. Define usable board as correct date labels and expected todo content, with initialization/loading finished.
   Network idle is not a readiness signal because replication and streams remain active.
4. Capture resource count/bytes by category: static assets, todo replication, attachment replication, application APIs, telemetry.
5. Use existing query console timers as supporting evidence, not end-to-end interaction timings.
6. Inspect trace stacks for IndexedDB/indexing, compaction, migration, React commits, and graph layout.
7. Record heap snapshots or consistent heap samples before/after extended navigation.
8. Separate optimistic feedback, local save, and confirmed remote durability. Current local mutation success is not remote acknowledgement.
9. Correlate server logs/spans with browser timings without exposing credentials or document contents.

## Baseline results

| Metric                           | Current PouchDB                                  | API prototype   |
| -------------------------------- | ------------------------------------------------ | --------------- |
| Authenticated startup            | Pending authenticated access                     | Not implemented |
| Daily forward/revisit navigation | Complete for kanban and table; see results below | Not implemented |
| Completion/timer feedback        | Pending designated test documents                | Not implemented |
| Remote durability                | Pending authenticated access                     | Not implemented |
| Memory and long tasks            | Pending authenticated access                     | Not implemented |
| External-update refetch scope    | Pending second-client scenario                   | Not implemented |

### Calibrated daily paging

Completed 92 forward and 92 reverse clicks per view, spanning July 5 through October 5, 2026.
Used a production frontend, headed Chromium 152, viewport 1440×1000, CouchDB 3.3.3, and isolated production database proxy routes.
Measured checkout includes uncommitted benchmark instrumentation atop `5eae4a3d`.
Preparation mode `bootstrap` excludes roughly four seconds of database preparation per view.
Normal application replication settings remain unchanged; initial queries settle before the first measured click.

| View   | Direction | Samples | Median ms |   p95 ms | Maximum ms |
| ------ | --------- | ------: | --------: | -------: | ---------: |
| Kanban | Forward   |      92 |     663.8 |    696.3 |    9,999.4 |
| Kanban | Reverse   |      92 |     669.9 | 28,243.8 |   29,574.9 |
| Table  | Forward   |      92 |   1,080.6 |  1,145.1 |    1,212.5 |
| Table  | Reverse   |      92 |     683.4 |    724.3 |      751.1 |

All 368 clicks reached the expected date and todo IDs; no failures or retries were omitted.
Kanban recorded nine samples above five seconds, concentrated around September 27–October 5.
Eight occurred on reverse paging. These observations require trace attribution; they do not establish PouchDB as the cause.
Percentiles describe this daily sequence, not independent trials or field-user percentiles.
All tested days contained due todos; this run supplies no empty-day measurements.

Local artifacts: `benchmark-results/day-paging-baseline/report.html`, `report.json`, and `daily.csv`.
Per-view `samples.jsonl` preserves every measurement, including outliers.
Reproduce with `pnpm build:web-client`, then `pnpm benchmark:day-paging --headed --months 3`.
Generate the aggregate reference first with `pnpm benchmark:profile-reference walterra`.

Calibration matches date density, context population sizes, activity date spans, payload histograms, and family placements.
Synthetic documents contain 5.6% fewer serialized bytes than the reference.
Independent field marginals, synthetic activity time-of-day/durations, unmatched tag popularity/title lengths,
and absent attachments/tombstones/revision history limit comparison accuracy.
Keep the same generated profile and fixture hash across architectural comparisons.

### Concurrent server-write pilot

Ran six days forward and reverse per case/view, July 5–11, with controls before and after ingestion.
Each case used a fresh container and browser with production indexes prepared before measurement.
Preparation version 2 avoids table-only sessions lacking indexes normally initialized by kanban.
This differs from the original baseline preparation; compare against the pilot's matched controls.

The pilot recorded 175 successful clicks. Thirteen of sixteen case/view runs completed.
RSS-200/table and both sustained-ingestion views exceeded the sixty-second exact-content readiness deadline.
Incomplete cases retain their successful samples, failure state, and earlier attempts. Their percentiles omit failed clicks.
All 800 acknowledged server-write revisions reached local PouchDB, including writes in incomplete cases.
Visible-update cases also verified rendered updated titles after measured paging.

| Scenario                               | Kanban maximum successful click | Table maximum successful click | Status                  |
| -------------------------------------- | ------------------------------: | -----------------------------: | ----------------------- |
| Initial control                        |                          0.70 s |                         1.15 s | Complete                |
| Ten unrelated updates                  |                          2.83 s |                        21.77 s | Complete                |
| Ten visible updates                    |                          2.83 s |                        22.00 s | Complete                |
| Ten RSS-style additions                |                          2.10 s |                        21.77 s | Complete                |
| Fifty RSS-style additions              |                          4.74 s |                        35.01 s | Complete                |
| Two hundred RSS-style additions        |                         15.17 s | Not a complete workload result | Table readiness failure |
| Two additions/second for sixty seconds |  Not a complete workload result | Not a complete workload result | Both readiness failures |
| Repeated control                       |                          0.67 s |                         1.17 s | Complete                |

Offscreen writes reproduce slow paging in this fixture. Stable repeated controls argue against general timing drift.
Table degradation also persists into later clicks without new local change arrivals during their measurement windows.
This establishes a workload association, not attribution to a specific index, query, or rendering mechanism.
The short sequences are diagnostic pilots, not statistically independent trials or reliable field-user percentiles.

Artifacts: `benchmark-results/background-write-pilot/report.html` and linked per-case HTML/JSON/CSV reports.
Per-view `background.json` records server acknowledgements, local revision verification, and arrival timestamps.
Readiness diagnostics distinguish captured clicks from missing capture. No traces were collected.

Reproduce with `pnpm benchmark:background-writes --headed --steps 6 --start-date 2026-07-05`.
The command returns nonzero for incomplete cases; preserve those failures during migration comparisons.

## First milestone acceptance

- Define numeric targets after collecting the baseline; proposed improvement target is 30% for problematic startup/navigation.
- Target optimistic feedback within 100 ms under the recorded environment.
- Demonstrate bounded cache growth and no unrelated-query refetch storm.
- Preserve revisions, scheduled fields, repeat-task behavior, and account isolation.
- Preserve legacy local data while the feature flag remains reversible.

## Next implementation slice

Implement a validated date-range list API and revision-safe completion API with tests.
Migrate weekly-board reads/completion behind a feature flag, retaining TanStack Query.
Do not copy the current broad invalidation or full-document revision substitution into the new architecture.
