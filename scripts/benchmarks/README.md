# Day-paging benchmark

Measures paging-button click to populated todo view in kanban and table.
Uses the production browser bundle, production authentication/database proxy routes, and disposable CouchDB Testcontainers.
Runs separately from ordinary E2E correctness tests.

## Opt-in telemetry

Add `--telemetry` to day-paging or background-write runs after configuring the server-side Collector environment.
See [Synology telemetry setup](../../spec/synology_telemetry.md) for TLS, protected credentials, and verification.
Reports record instrumentation state and run ID; do not compare traced runs directly with disabled baselines.
Without the flag, benchmark Node SDKs remain disabled and browser exports are discarded.

## Local setup

Run commands from the repository root. Requires Docker, `agent-browser`, and Chromium:

```bash
npm install -g agent-browser
agent-browser install
pnpm benchmark:profile-reference walterra
pnpm build:web-client
pnpm benchmark:day-paging --headed --months 3
```

The reference profiler reads the configured CouchDB account without modifying documents, attachments, or revisions.
It saves aggregate statistics and a deterministic synthetic profile under ignored `benchmark-results/reference/`.
It does not save source IDs, titles, descriptions, context/tag names, note content, or credentials.
Freeze the generated profile for before/after comparisons rather than regenerating it between implementations.

The benchmark uses only the generated profile. It never seeds into the reference database.
It starts and stops its own isolated server/container; existing development servers remain untouched.

## Paging scenarios

By default, page daily through three calendar months ending at the profile reference date, then revisit backward.
For reference date `2026-10-05`, the initial day is `2026-07-05`, followed by 92 forward clicks and 92 reverse clicks per view.
Kanban and table use fresh browser sessions and identical fixture data.
Database preparation and application warm-up are excluded from paging timings.

Default `--warmup-mode bootstrap` prepares the local database before mounting the application,
using one-shot 500-document replication batches and establishing both push/pull checkpoints.
Preparation version 2 also initializes the existing production design documents and Mango indexes.
Table-only sessions otherwise lack indexes normally initialized by kanban.
Measured paging retains the application's normal live-sync settings.
Version 1 prepared documents in roughly four seconds. Version 2 prepared documents and indexes in roughly twelve seconds.
The application then requires three consecutive idle query observations before measured clicks.

Use `--warmup-mode replication` to retain the slow first-run application synchronization path for diagnostics.
The report records the preparation mode and version. Compare runs with identical preparation.

```bash
# Both views, visible browser
pnpm benchmark:day-paging --headed --months 3

# One view, shorter/custom date sequence
pnpm benchmark:day-paging --headed --views table --start-date 2026-09-01 --steps 30

# Unattended run
pnpm benchmark:day-paging --months 3

# Frozen/custom synthetic profile
pnpm benchmark:day-paging --profile path/to/profile.json --headed
```

Rebuild the frontend before each comparison. Keep the browser foreground, viewport, hardware,
Docker resource limits, browser mode, and fixture hash consistent.

## Background-write scenarios

```bash
# Matched controls and all write cases; fresh container/browser per case and view
pnpm benchmark:background-writes --headed --steps 6 --start-date 2026-07-05

# One case with the full three-month sequence
pnpm benchmark:day-paging --headed --months 3 --background rss-200

# Resume a matrix with identical settings; preserves interrupted attempts
pnpm benchmark:background-writes --headed --steps 6 --start-date 2026-07-05 --resume --output path/to/matrix
```

The matrix defaults to twelve days forward and reverse, not three months.
It repeats the no-write control after the write scenarios. It never pools cases into one percentile.

| Scenario                      | Server writes                                                 |
| ----------------------------- | ------------------------------------------------------------- |
| `control`                     | None                                                          |
| `unrelated-updates`           | Update up to ten todos outside the measured date range        |
| `visible-updates`             | Update up to ten top-level todos on the first destination day |
| `rss-10`, `rss-50`, `rss-200` | Create an offscreen burst with RSS-style fields               |
| `sustained`                   | Create two offscreen todos per second across sixty batches    |

The writer runs in a separate process; synchronous browser commands cannot pause its schedule.
Writes start one second after writer readiness. Receipts record scheduled, started, and acknowledged times.
Existing updates change titles and metadata, not IDs or due dates. RSS-style additions remain offscreen.
This preserves the exact expected-ID contract. Visible additions and actual RSS fetching remain separate workloads.

Read-only client diagnostics record local change arrival timestamps and revisions without document contents.
Each acknowledged revision must match local PouchDB after paging. Visible updates also require rendered title verification.
Arrival timestamps measure local change notifications, not rendered update latency.
Sustained writes can outlast the measured clicks; reports separate overlap counts from total verified writes.

Per-view artifacts include `write-plan.json`, `server-writes.jsonl`, `background.json`, and `writer.log`.
CSV samples include click/ready epoch timestamps, local change counts, and in-flight query counts.
Failures retain snapshots, readiness state, completed samples, and background verification results.
Incomplete cases return a nonzero exit code. Their failed clicks are not latency samples.
Do not interpret incomplete-case percentiles as a successful workload result.

The writer simulates server database ingestion, not RSS network fetching or scheduler internals.
No production sync settings change. No traces are collected.

## Reports

Results appear in `benchmark-results/day-paging-<timestamp>/`:

- `report.html`: view/direction comparisons, daily samples, and latency buckets.
- `report.json`: raw samples, summaries, and environment/workload metadata.
- `daily.csv`: per-click timing and todo-count data.
- `calibration.json`: matched reference dimensions, document-size difference, and limitations.
- Per-view `bootstrap.jsonl`, `warmup.jsonl`, and `application-warmup.jsonl`: preparation progress.
- Per-view `samples.jsonl`: each measurement persisted before the next click.
- `server.log`: isolated backend diagnostics.
- Per-view failure snapshots and browser errors when a run fails.

Set an explicit output directory with `--output /tmp/eddo-benchmark`. Use a fresh directory per run.
A failed view retains its samples and diagnostics; remaining views still run.
Reports label incomplete runs, exclude failures from percentiles, and return a nonzero exit code.

Report minimum, median, maximum, p75, p90, and p95 separately for each view and direction.
Separate populated and empty days. Percentiles describe sequential observed clicks, not independent trials or field-user metrics.
Reverse paging measures revisits, not guaranteed cache hits: the application may evict prior ranges.

## Measurement contract

A capture-phase listener timestamps the trusted paging-button click inside the browser.
Readiness requires the requested date and exact expected query-document IDs on the committed view,
with loading and placeholder state cleared, followed by two animation frames.
The observer delegates capture to document so background renders cannot replace the armed element.
It rechecks readiness after both frames and enforces a sixty-second deadline.
The contract works for empty days, hidden child rows, and table virtualization.
It measures view-population latency rather than date-label changes or automation transport duration.
It is not INP, guaranteed paint timing, or server durability.

The current view loading state includes activity reads. Later background subtask-count updates are not included.
The production prefetching behavior stays enabled.

## Replication visibility

Print document count, percentage, elapsed time, throughput, completed buffered database requests,
and recent request paths every two seconds. Exclude design documents from the count.
Exit when the expected count and final seeded document exist locally, then check view readiness.
Reject replication stalled for 120 seconds. The default maximum duration is 900 seconds, not a fixed sleep:

```bash
pnpm benchmark:day-paging --headed --warmup-timeout 1200
```

Visible-content readiness has a separate 60-second timeout.
Monitoring occurs outside measured paging timings and persists on failure.

## Calibration and limitations

The generator validates source counts, due-date density, description-size distribution, activity-entry counts,
note counts/content sizes, metadata sizes, tag counts/cardinality, completion totals, scheduled todos,
active timers, context population sizes, activity start/end-date spans, and parent-child fan-out/depth/cross-day placements.
Undated todos remain in the dataset without being counted as a populated day.

The current walterra profile has 9,899 alpha4 todos, 43 children across nine parents, and 19 cross-day edges.
A generated fixture currently contains roughly 5.6% fewer serialized JSON bytes than the reference.

Independent marginals do not preserve all field correlations. Activity time-of-day/durations, tag popularity,
and title lengths are synthetic. Activity dates and context population sizes match the reference. Attachments, tombstones, and revision history are not generated.
The generator rejects unsupported nested/cyclic/dangling hierarchies, dependencies, and legacy versions rather than silently omitting them.
These limits remain explicit in `calibration.json`; the fixture is not a byte-for-byte production clone.

The reduced benchmark backend excludes schedulers, search, chat, preference streaming, and audit APIs.
It uses real authentication and todo/attachment proxy implementations, not mocked todo queries.

The default CouchDB image pins a version; pin a digest with `--couch-image couchdb@sha256:...` for stricter reproducibility.
Record browser version and fixture hash from the report. Resource counts include completed buffered requests,
not all in-flight requests. Chromium heap measurements remain approximate.
Testcontainers isolates data, not CPU or disk timing. Repeat complete runs when comparing implementations.

## Smoke profile

Provide a small explicit profile to verify the harness without inspecting an account:

```json
{
  "name": "smoke",
  "seed": 647,
  "referenceDate": "2026-10-05",
  "totalTodos": 120,
  "days": 40,
  "contexts": 4,
  "descriptionBytes": 128,
  "activityEntries": 2
}
```

```bash
pnpm benchmark:day-paging --profile /tmp/smoke.json --start-date 2026-10-05 --steps 2 --headed
```

## Verification

```bash
pnpm vitest:run scripts/benchmarks/day_paging_fixture.test.ts scripts/benchmarks/day_paging_calibration.test.ts scripts/benchmarks/day_paging_summary.test.ts
pnpm exec eslint scripts/benchmarks/*.ts packages/web-api/src/benchmarks/*.ts
```
