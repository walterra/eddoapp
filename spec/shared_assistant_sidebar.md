# Shared assistant sidebar

Status: step 2 complete; shared runtime extracted into `@eddo/assistant-server`. Public web admission remains disabled.

Source: [GitHub issue #336](https://github.com/walterra/eddoapp/issues/336).

## Scope

Add an assistant sidebar to the main todo application. Share the user's active Pi Durable conversation with Telegram.
Keep sandbox/container coding chats independent and unchanged. Reuse their assistant-ui presentation framework, not their execution adapter.

Provide one active assistant conversation per account. Preserve existing Telegram `/new` behavior and conversation mappings.
Reflect active-conversation changes in the sidebar. Exclude new conversation-management controls from this scope.

## Inspection findings

| Existing source                                                     | Responsibility                                              | Integration decision                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/web-client/src/components/page_wrapper.tsx`               | Owns activity and sandbox sidebar state                     | Add independent assistant visibility state; preserve sandbox preferences and navigation |
| `packages/web-client/src/components/todos_view.tsx`                 | Renders header toggles and adjacent sidebars                | Add a distinct assistant toggle and lazy-loaded panel                                   |
| `packages/web-client/src/components/audit_sidebar.tsx`              | Renders sticky activity panel and dismissal controls        | Follow panel placement, header hierarchy, and dismissal conventions                     |
| `packages/web-client/src/components/chat/chat_sidebar.tsx`          | Manages sandbox sessions in a 480px panel                   | Preserve session selection, dialogs, and container behavior                             |
| `packages/web-client/src/components/chat/assistant-ui/thread.tsx`   | Renders thread, composer, Markdown, and copy actions        | Reuse presentation with explicit capability options where needed                        |
| `packages/web-client/src/components/chat/chat_runtime_provider.tsx` | Adapts sandbox RPC events through `useExternalStoreRuntime` | Build a separate Durable adapter using the same assistant-ui runtime API                |
| `packages/telegram_bot/src/durable/host.ts`                         | Opens per-user journals and admits Telegram/report requests | Generalize host identity and admission without introducing another owner                |
| `packages/telegram_bot/src/durable/runtime.ts`                      | Maps application conversations to native conversations      | Preserve mappings, queues, task registration, and recovery                              |
| `packages/telegram_bot/src/durable/projection.ts`                   | Projects completed exchanges with stable message IDs        | Extend channel metadata and lifecycle visibility without duplicate history              |
| `packages/core-shared/src/types/assistant-conversation.ts`          | Defines cross-channel application history                   | Extend existing assistant types instead of sandbox session types                        |

The existing thread always renders a cancel control while running. The assistant adapter must not imply cancellation without backend support.
The sandbox runtime initializes local history once. The assistant adapter needs live history reconciliation and stable request identifiers.
The current projection writes completed exchanges only. Admission and progress need durable visibility before completion.
The current runtime requires Telegram identity for ownership, authorization, and tool execution. Web-only accounts need account-based authorization.

## Target boundaries

```text
Main-app assistant sidebar -> authenticated web API -> sole assistant host
Telegram adapter ----------------------------------> sole assistant host
Scheduled reports ---------------------------------> sole assistant host
                                                          |
                                               one per-user Durable journal
                                                          |
                                            shared active native conversation
                                                          |
                                            application history/status projection
```

The web API never independently opens an execution journal.
Keep the existing owner process initially; separate host initialization from Telegram polling and bot availability.
Define authenticated internal admission and status transport before exposing browser endpoints.
Treat journal ownership, authorization, and migration compatibility as release blockers.
Do not activate the unintegrated distributed-ownership foundation as part of this feature.

Extract reusable runtime functionality into a shared server package after verifying the in-place channel adapter integration.
Keep Telegram formatting, typing, and transport delivery inside the Telegram adapter.
Preserve persisted task names and checkpoint compatibility, or provide an explicit tested migration.
Do not manufacture Telegram IDs for web-only accounts or silently transfer existing journal ownership.

## User interface

- Label the new panel Assistant; distinguish its toggle from sandbox Chat and Activity.
- Place the panel beside the todo content using the existing sidebar layout.
- Start closed; keep assistant visibility separate from existing sidebar preferences.
- Target a 480px desktop panel, constrained to the viewport on narrow screens.
- Preserve independent activity and sandbox visibility; prevent inaccessible controls on narrow screens.
- Provide accessible toggle, heading, close control, keyboard focus, and dark-mode styles.
- Load assistant-ui lazily; opening the panel never creates a container.
- Display one shared thread, without sandbox session lists, lifecycle controls, or provider-key warnings.
- Show loading, sending, queued, working, failed, unavailable, and reconnecting states.
- Reconcile optimistic messages with accepted durable requests after reconnect or reload.
- Reuse Markdown and copy rendering. Do not expose private model reasoning through status updates.

## Admission, history, and delivery

Authenticate web requests through the existing account session. Resolve account identity server-side.
Namespace stable web request IDs by account. Reject identifier reuse with different message content.
Return admission promptly; browser disconnects and sidebar dismissal never cancel accepted work.
Expose paginated history, request status, and resumable SSE updates with account isolation.
Recover missed updates from persisted state; do not depend on an in-memory event buffer.
Revalidate authorization and MCP credentials before resumed side effects.
Use host-configured models and provider credentials, matching Telegram.

Publish messages from both channels into the shared web history.
Deliver Telegram-origin replies through Telegram. Deliver web-origin replies through persisted web state, without automatic Telegram notifications.
Route progress by request channel; web requests never send Telegram typing or tool-progress notices.
Keep scheduled reports in the shared active conversation with existing read-only tools and delivery policies.
Preserve the existing manual-report printing policy; verify web delivery does not accidentally trigger Telegram transport.

## Verification gates

- Verify Telegram -> web -> Telegram context continuity against the real Harness.
- Verify concurrent admission, stable deduplication, and reused-ID payload rejection.
- Verify browser disconnect, SSE reconnect, host restart, and projection recovery.
- Verify existing pending Telegram checkpoints resume without duplicate committed delivery.
- Verify web-only accounts, revoked authorization, and cross-account access denial.
- Verify active-conversation changes and scheduled-report context.
- Verify sidebar accessibility, narrow-screen behavior, and unchanged sandbox chats.
- Use scripted providers and disposable CouchDB; exclude paid model calls by default.
- Run formatting, lint, types, relevant tests, and `pnpm check:commit` before completion.

Follow [Durable Telegram operations](durable_telegram_operations.md) for current production behavior until implementation updates that contract.

## Implementation checkpoints

Pause after each checkpoint for user confirmation. Report changed files, checks, and a suggested commit message; never commit automatically.

- [x] 1. Inspect sidebar integration and reusable assistant-ui components; record boundaries.
- [x] 2. Generalize Durable identity, channel contracts, and runtime/channel adapters with compatibility tests.
  - [x] 2a. Add account-based request contracts, legacy Telegram normalization, and channel-neutral history projection.
  - [x] 2b. Add account-based journal ownership and fresh authorization APIs while preserving existing Telegram identity guards.
  - [x] 2c. Integrate account authorization, channel-aware delivery, and shared Harness admission with compatibility tests.
  - [x] 2d. Extract the verified shared runtime into a server package without importing Telegram host code.

Step 2a preserves persisted request inputs, task names, owner records, and Telegram projection behavior.
Its shared request contract supports web-only account identity without placeholder Telegram identifiers.
The existing Telegram projection callback delegates to the channel-neutral projection through a normalization adapter.
Step 2b adds fresh account-registry authorization for channel-neutral requests and account-only MCP contexts.
Each authorization call rechecks active status, current credentials, Telegram binding when applicable, and scheduled-report consent.
The runtime owner record retains its existing document kind and version. Legacy Telegram pins remain mandatory when reopening those journals.
New account-only owner records omit Telegram identifiers. Adding or removing an owner pin requires explicit migration; no automatic transfer exists.
Real Harness reopen tests cover account-only owners and legacy owner records.
Step 2c routes the existing Telegram host through `openAssistantRuntime`, retaining the same Harness and persisted task names.
The shared runtime accepts legacy Telegram inputs and validated channel-neutral requests, with account authorization at admission and resumed phases.
Tool entries persist channel-neutral request metadata for fresh authorization before MCP calls and archive reads.
Legacy tool entries retain pinned Telegram authorization. Web tool runs suppress Telegram progress messages.
Web replies bypass Telegram formatting and sending, then use the existing persisted printing and projection phases.
Manual report printing remains injected and claimed before its external effect.
Web requests use account-scoped identifiers and atomic payload-hash receipts; changed payloads cannot reuse accepted request IDs.
Retries retain original work across admission timing and active-conversation changes.
Scripted real-Harness tests cover web-only tools, cross-channel context, credential revocation, relinking rejection, and legacy delivery recovery.
Step 2d moves Harness execution, state, admission, native legacy-context import, and model configuration into `@eddo/assistant-server`.
The shared runtime accepts injected reply preparation, delivery, authorization, and tool extensions.
Telegram formatting, retries, MCP transport, account-registry access, printer access, and polling remain in the host package.
Consumers import shared symbols directly from `@eddo/assistant-server`; obsolete Telegram re-export modules are removed.
The shared package retains a type-only `grammy` dependency for legacy checkpoint entities; it never imports Telegram application code.
Standalone real-Harness tests exercise execution and journal reopening without importing a channel host.
The package participates in workspace builds, default unit tests, and synchronized versioning.
See the [assistant server guide](../packages/assistant-server/README.md) for its execution boundary.
No public web endpoint or second journal owner exists yet.

Remaining checkpoints:

- [ ] 3. Expose a single-owner assistant host with authenticated internal admission and status transport.
- [ ] 4. Add authenticated web history, submission, status, and resumable live-update endpoints.
- [ ] 5. Add the main-app assistant sidebar and dedicated assistant-ui runtime adapter.
- [ ] 6. Complete channel-aware delivery, progress routing, and idempotent history reconciliation.
- [ ] 7. Run cross-channel/recovery verification and update operational documentation.
