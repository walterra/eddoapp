# Assistant server runtime

Provides server-only Pi Durable execution for Eddo's shared assistant conversation.

## Execution boundary

Owns the Harness, native conversation mapping, serialized admission, request deduplication, checkpoints, recovery, and model configuration.
Accepts legacy Telegram inputs and channel-neutral assistant requests from `@eddo/core-shared`.
Preserves existing document kinds, task names, task versions, and delivery checkpoints.

Hosts inject:

- An opened storage adapter and authenticated account identity.
- Model providers, instructions, generation settings, and optional memory context.
- Authorization callbacks for admission and resumed request phases.
- Tool and archive extensions with their own per-call authorization.
- Reply preparation, delivery, printing, and application-history projection callbacks.
- Legacy history loaders and error reporting.

`openDurableRuntime` opens and resumes a journal; it does not authenticate an HTTP request.
Keep it behind an authenticated host. Never open another owner for the same journal.
The package provides no ownership election, fencing, HTTP listener, scheduler, or background database discovery.
Its authenticated request handler delegates to host-injected admission and status operations; the host owns the network listener.
See the [internal host contract](../../spec/shared_assistant_host.md) for protocol and deployment restrictions.

## Channel adapters

The Telegram package composes MCP extensions, account authorization, reply preparation, and transport delivery around this runtime.
It retains polling, typing indicators, Markdown-to-Telegram formatting, send retries, printer access, and database provisioning.
Consumers import shared execution symbols directly from `@eddo/assistant-server` or its module subpaths.

The shared package imports no Telegram application, web API, or sandbox code.
Its `grammy` import is type-only, preserving rendered entities in existing Telegram checkpoints.
The runtime never calls Telegram or creates a sandbox container.

Delivery adapters receive the persisted delivery task, runtime, and context.
They advance checkpoints through the Harness instead of maintaining a second execution loop.
Printing and history projection retain their persisted phases after delivery.
Adapters must revalidate authorization before external side effects.

## Build and verification

Run commands from the repository root:

```bash
pnpm build
pnpm vitest:run packages/assistant-server/src packages/telegram_bot/src/durable packages/telegram_bot/src/ai
pnpm test:integration:durable
pnpm check:commit
```

Unit tests use scripted providers and revision-checked in-memory journal storage.
Package boundary tests reject imports from channel hosts.
Durable integration tests use disposable CouchDB and require Docker; they make no model API calls.

See [Durable operations](../../spec/durable_telegram_operations.md) for ownership, deployment, and recovery restrictions.
See [shared assistant scope](../../spec/shared_assistant_sidebar.md) for remaining host and web integration work.
