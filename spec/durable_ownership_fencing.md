# Durable journal ownership and fencing

## Implementation status

The ownership foundation is implemented in `packages/telegram_bot/src/durable/journal_ownership.ts`.
Production startup does not use it yet. The single-owner deployment requirement remains unchanged.

- [x] Atomic competing-owner acquisition on the journal publication head.
- [x] Unique owner tokens and retained, monotonically increasing handover epochs.
- [x] Preserve ownership metadata across adapter journal publications.
- [x] Reject cached stale publication revisions through CouchDB CAS.
- [x] Check current ownership before guarded external operations.
- [x] Drain admitted guarded operations before releasing ownership.
- [x] Fail closed after an ambiguous acquisition or release acknowledgment.
- [ ] Production storage lifecycle and side-effect integration.
- [ ] Safe crash recovery and operator recovery tooling.
- [x] Receiver-side MCP command deduplication and completed-result replay.
- [ ] Receiver-enforced ownership fencing and remote delivery idempotency.
- [ ] Validated automatic failover under process pauses, partitions, and delayed requests.

Do not enable production ownership by calling acquisition alone. Every execution path must participate first.

## Publication protocol

Ownership lives on `pi:head`, not a separate lock document.
The existing adapter publishes commits using that document's revision precondition.
An acquisition therefore invalidates cached publication revisions through the same atomic CouchDB write.
A separate ownership-document check would leave a race between checking the lock and publishing the journal.

The claim contains a random token and a positive safe-integer epoch.
The head retains `eddoOwnershipEpoch` after release, so the next acquisition advances its epoch.
Adapter publications preserve the claim through their existing head-copy behavior.
The guarded transport never refreshes stale revision preconditions to force a publication through.

Assumptions:

- Every participating writer uses the ownership-aware transport.
- Old binaries and unguarded adapters are stopped before enabling ownership.
- One authoritative CouchDB database supplies revision arbitration.
- Independent writable replicas and partitioned active-active ownership remain unsupported.
- Administrators do not roll back or manually edit ownership records while owners can still execute.

An unmodified adapter can open a currently claimed head and copy its metadata.
This protocol coordinates cooperating clients; it is not an authorization boundary against unmodified or malicious writers.

## No automatic expiration

Claims deliberately do not expire. No heartbeat, wall-clock comparison, or automatic takeover exists in this foundation.
A stopped process, a paused process, and a partitioned process cannot reliably distinguish each other through application timeouts.
Introducing expiration without fencing can leave an old process executing after a replacement takes ownership.

This means a hard crash leaves the claim held.
Wiring this version directly into production would regress automatic restart recovery.
Production integration remains blocked until recovery behavior and external-effect handling are approved and tested.

Default production behavior stays unchanged: externally enforce one bot owner and use stop-first deployment.

## External-effect boundary

`run()` checks current ownership before invoking its callback and tracks the resulting promise.
Release rejects new guarded operations and waits for admitted operations to settle.
A failed ownership check prevents the callback from starting.

This does not atomically fence a remote service:

- A process can pause between an ownership check and issuing a request.
- An issued request can reach its receiver after a later ownership transition.
- A network timeout can settle the client promise while server-side work continues.
- Waiting for local promises does not prove that every remote effect has stopped.

Telegram does not accept this fencing epoch as an execution precondition.
MCP commands now have receiver-side attempt deduplication, but no ownership-epoch fencing contract.
Journal fencing therefore must not be described as exactly-once external execution or safe automatic failover.
Retain the existing non-replay-safe mutation policy and ambiguous-delivery safeguards.

## MCP command receipts

Native mutation calls derive operation IDs from a persisted journal namespace and tool-task ID.
Preserve that namespace during migration and restore; replacing it changes command identities.
The client sends `x-eddo-operation-id`; the model cannot select or override that transport identifier.
Authenticated MCP sessions use private `${userDatabase}_mcp_operations` databases with administrator-only access.

The receiver reserves each operation through a revision-checked create before invoking the tool handler.
Matching completed requests return the saved result. Reused IDs with different arguments or tools are rejected.
Completed receipts record handler responses, including returned tool errors; they do not independently prove business success.
Pending receipts block duplicate execution indefinitely; there is no automatic expiry or retry.
An ambiguous reservation acknowledgment can block a command that never executed. Safety takes priority over availability.
An ambiguous completion acknowledgment returns the saved result on retry if completion actually committed.

This provides at-most-once handler invocation for a command, not atomic multi-document mutation execution.
A handler can partially update todo, audit, or attachment documents before failing.
Pending receipts require state inspection, not deletion or blind replay.
The receiver saves only argument hashes, status/timestamps, and serialized results; results can contain private task data.
Receipts are limited to 1 MB serialized responses and must be retained with authoritative execution backups.

Ordinary MCP clients without the operation header remain compatible.
Mutation tools remain non-replay-safe in Pi Durable; do not change replay policies based on receipts alone.
All MCP servers must run the receipt-aware implementation before relying on this protection.
This protocol does not reject a stale owner submitting a different command ID.

## Remaining integration design

Telegram polling requires one global bot leader, not independent per-user journal leaders.
Separate processes owning different users would still compete for the same bot's Telegram updates.
Global leadership must cover polling, scheduler admission, runtime recovery, and ownership transitions.

1. Open the ownership-aware storage transport before resuming any Harness work.
2. Cover interactive and scheduled admission, MCP calls, projections, Telegram sends, progress, printing, and recovery callbacks.
3. Stop admissions before shutdown; drain execution and publication before releasing the claim.
4. Establish explicit behavior for ambiguous external operations and lost acknowledgments.
5. Add approved crash-recovery tooling without deleting ownership or journal documents blindly.
6. Add receiver-side ownership fencing and pending-command handover barriers before enabling automatic takeover.
7. Test separate processes against real CouchDB, including pauses and partitions, before claiming multi-instance safety.

## Verification

Unit tests exercise racing claims, adapter publication, stale revisions, operation draining, ownership loss, and ambiguous acquisition.
Disposable CouchDB integration tests verify actual revision arbitration, publication fencing, and graceful handover.
These tests do not establish partition tolerance or receiver-enforced external-effect fencing.

```bash
pnpm vitest:run packages/telegram_bot/src/durable/journal_ownership.test.ts
pnpm test:integration:durable
```
