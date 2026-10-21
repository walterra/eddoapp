# Durable Telegram operations

## Supported execution boundary

Use Pi Durable as the sole Telegram execution authority. Keep application chat projections separate from execution journals.

| Capability         | Supported behavior                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Chat scope         | Linked private Telegram chats; group messages receive guidance before authentication or session access |
| Message format     | Markdown renders through Telegram entities; explicit formatting rejection falls back to plain text     |
| Models             | Registered catalog models selected through `LLM_MODEL`; unknown IDs fail validation                    |
| Process ownership  | Exactly one bot process across every host sharing the runtime databases                                |
| Recovery           | Persisted requests, delivery checkpoints, and bounded scheduled-generation retries                     |
| External effects   | Read replay; no blind replay of interrupted mutations                                                  |
| Printing           | Claimed before the attempt; ambiguous printing can be missed rather than repeated                      |
| Storage            | Complete journal history loads into memory; no supported journal garbage collection                    |
| Ownership transfer | No supported automatic transfer or operator transfer command                                           |

Neither Telegram polling conflicts nor missing activity prove that another journal owner has stopped.
The adapter supplies no distributed lock, fencing token, ownership election, or automatic failover.
Do not promote an independently writable replica while another owner can remain active.

## Deploy and restart

1. Run `pnpm check:commit` and the relevant unit and integration tests.
2. Verify `LLM_MODEL`, provider credentials, generation limits, database prefix, and CouchDB permissions.
3. Verify backups include the runtime, application chat, todo, and user-registry databases.
4. Stop the existing bot through its process supervisor. Wait for shutdown and process termination.
5. Confirm every other deployment using these databases remains stopped. Use stop-first deployment, never overlapping replicas.
6. Start one replacement bot. The operator runs `pnpm dev:telegram-bot` for development deployments.
7. Inspect recovery logs with `pnpm logs:tail` when using the unified development launcher.
8. Check a private-chat request and one report occurrence. Confirm duplicate request identities do not create new work.

Keep database names and prefixes unchanged during upgrades unless performing a reviewed migration.
Do not enable an alternative execution path when Durable recovery fails.
Recovered pending requests can resume immediately after startup.

## Back up and restore

- Back up each runtime database as a complete authority, including journal and publication-head documents.
- Use `pnpm backup:interactive` and `pnpm backup:verify`; inspect the selected database inventory.
- The default `eddo_*` pattern includes default-prefix runtime databases. Custom prefixes require an explicit matching selection.
- Include private `${userDatabase}_mcp_operations` receipt databases in coordinated backups; default `eddo_*` selection includes them.
- Treat application chat databases as projections, not replacements for runtime journals.
- Pause the sole bot and relevant writers when requiring a coordinated restore point across databases.
- Backup operations do not provide a transaction across the runtime, registry, chat, and todo databases.

Restore procedure:

1. Stop every bot owner and prevent supervisors from restarting them.
2. Preserve the current databases before replacing anything.
3. Use `pnpm restore:interactive` to restore complete reviewed backups into the intended database inventory.
4. Verify inventories, database security, registry identity, and required todo/chat databases before starting the bot.
5. Review external effects since the backup timestamp. Restoring older receipts can duplicate effects that already occurred.
6. Start one owner and inspect resumed requests before restoring normal scheduling.

Do not splice publication heads, edit journal records, apply TTL deletion, or restore selected journal documents.
Do not assume restoring chat history restores native execution state.

## Interrupted or failed work

| Symptom                             | Action                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| Model generation failed             | Inspect its failed outcome and delivered notice; do not treat notice delivery as execution success |
| Scheduled model error               | Allow at most two additional read-only attempts within the occurrence deadline                     |
| Interactive mutation interrupted    | Inspect current todo state before submitting another mutation                                      |
| Telegram send ambiguous             | Check Telegram and delivery receipts; a retry can duplicate the affected chunk                     |
| Print ambiguous                     | Check the printer; automatic recovery does not repeat the claimed attempt                          |
| Projection unavailable              | Restore the chat database; independent projection retries do not block Telegram replies            |
| Telegram delivery unavailable       | Restore connectivity before expiry; delivery stops after five failed sends or permanent API errors |
| Journal publication failed          | Allow the failed runtime to close and recovery to reopen it; do not reuse failed handles           |
| Relinked Telegram identity rejected | Keep execution blocked pending an approved ownership migration                                     |

Delivery backoff persists across restarts and honors Telegram rate-limit delays, with a minimum of 30 seconds.
Scheduled delivery expires at the occurrence's local day boundary. Interactive delivery expires one hour after its generation deadline.
Delivery expiry and permanent failures skip printing. Ambiguous sends can still duplicate chunks within the retry budget.

After six minutes, the Telegram handler stops waiting without cancelling admitted work.
Interrupted waits produce a pending notice rather than an execution-failure reply, including when recovery can resume work.
Do not repeat a pending request until its outcome is confirmed. Final replies continue through bounded durable delivery.

Do not delete request or MCP operation receipts to force a retry. The request may already have performed an external effect.
Pending MCP receipts have unknown outcomes and never expire automatically. Inspect todo, audit, and attachment state before recovery.
Do not roll back to pre-Durable execution while journaled work remains pending.
Older binaries also need review before resuming checkpoints introduced by newer code.

## Telegram identity changes

1. Stop all owners and back up the complete runtime, registry, todo, and chat databases.
2. Verify both identities and review pending requests, ambiguous mutations, deliveries, and print claims.
3. Keep the journal blocked until a reviewed migration establishes ownership and pending-work handling.

Changing the registry link does not transfer journal ownership.
No supported ownership-transfer tool exists. Do not bypass the guard by deleting owner or journal documents.

## Capacity monitoring

Monitor process RSS, Node heap usage, CouchDB database sizes, recovery duration, and repeated runtime-open failures.
Set deployment-specific memory and recovery-time budgets; alert before the process approaches those budgets.
Pause the bot for investigation when those budgets are exceeded.

Context compaction reduces model input, not journal size or journal-loading memory.
CouchDB compaction does not implement Pi journal snapshots or garbage collection.
Do not delete old journal records to reclaim space.
Snapshots, bounded-memory storage, safe journal retention, and distributed ownership require adapter-level support.

## Report response contract

`getBriefingData` and `getRecapData` expose bounded report projections, not complete todo documents.
Metadata declares `contractVersion: 2`, `itemsAreCompleteTodos: false`, and `detailTool: "getTodo"`.

- Use `id` or its compatibility alias `_id` for report items.
- Read `metadata.counts` and `metadata.selection`; returned array lengths are not total counts.
- Treat totals as lower bounds when `countExact` is false.
- Retain links up to 512 characters and relationship identifiers up to 80 characters.
- Retain at most five dependency identifiers. Oversized references are omitted, never shortened into different references.
- Read `fieldsTruncated` before assuming all details or tags were returned.
- Fetch `getTodo` for full descriptions, metadata, notes, raw tracking maps, and complete dependency lists.
- Treat `trackedMinutes` as cumulative stored tracking, not today's duration.

The contract restores useful aliases and references, not the full legacy document response shape.
Clients expecting complete todos need migration to explicit detail retrieval.

Corrected report text receives a deduplicated native context override before Telegram delivery.
Original provider messages remain immutable audit records. Later model context uses the corrected text.
Overrides apply to newly processed reports; historical completed requests are not rewritten automatically.
An override cannot change a model request already in flight before the correction was placed.

## Behavioral verification

Offline checks cover the native provider boundary, deterministic fixtures, and CouchDB recovery.
Real-model native recordings live in the original model directories and run through CI playback.
Refreshing them requires provider credentials and incurs API charges:

```bash
pnpm test:integration:agent-loop:record
pnpm test:integration:agent-loop:playback
```

Never manufacture native cassettes from legacy text-protocol recordings.
