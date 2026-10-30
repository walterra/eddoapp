# Shared assistant sidebar

Renders the main application's shared web/Telegram conversation through assistant-ui.
Sandbox/container chats keep their existing runtime, sessions, controls, and provider-key preferences.

## UI boundary

The main header provides a separate Assistant toggle. Visibility starts closed and resets when the authenticated account changes.
Opening or closing Assistant never changes activity-log or sandbox visibility preferences.

Wide viewports use a 480px inline sidebar. Smaller viewports use a native modal dialog, full-width below 640px.
The dialog supplies browser-native focus containment; Escape and the close control dismiss it.
Closing restores focus to the previous control and cancels read-only subscriptions, not accepted execution.

The sidebar reuses the existing thread, Markdown, copy actions, and composer primitives.
A separate `useExternalStoreRuntime` adapter supplies server messages and optimistic user text.
It exposes no container lifecycle, model credentials, reasoning blocks, or unsupported cancellation action.
Sandbox threads retain cancellation by default.

## Browser session

`assistant_session.ts` composes functional state, history, transport, and submission controllers.
These controllers manage presentation and HTTP requests only. Pi Durable remains the sole generation and tool authority.

- Uses the current AuthProvider JWT in HTTP headers; tokens never enter SSE URLs.
- Fetches a fresh history snapshot before opening or reconnecting the stream.
- Resumes from the last processed event cursor and coalesces history invalidations.
- Loads older pages without replacing the live cursor.
- Reconnects with bounded backoff and honors server rate-limit delays.
- Stops automatic reconnects after authorization failure.
- Cancels timers, history reads, and SSE on teardown; admission uses an independent HTTP timeout.

Connection state describes the live projection transport. Host availability errors appear separately.
SSE provides history invalidations and durable status snapshots, not token streaming.

## Pending request recovery

The initial composer permits one unresolved browser submission per account at a time.
Generate one UUID and compute its stable server projection IDs before sending.
Persist the UUID and message text before admission; unavailable storage prevents sending.
HTTPS or localhost is required for browser cryptography.

Pending records use `eddo.assistant.pending.v1.<encoded-username>` in localStorage.
Records contain unresolved message text, timestamps, projection IDs, and optional admission receipts—not JWTs or provider credentials.
They are not encrypted. Logout retains unresolved records for account-scoped recovery on a later login.
Completed records clear after their assistant projection appears. Terminal notices can also be dismissed explicitly.
Corrupt or conflicting records fail closed rather than silently discarding unknown execution state.

A lost admission response remains unconfirmed, not failed.
Explicit retry first queries durable status, then resends the same UUID only when admission was never confirmed.
An admitted request missing from status never automatically resubmits.
Terminal failures never trigger automatic mutation replay; the UI directs users to inspect task state.
Late admission responses cannot resurrect cleared records or regress a newer durable status.

Optimistic text reconciles by exact projection ID, never by matching message content.
Earlier-conversation requests remain tracked without being inserted into the new active thread.
Server-side admission-time projection and cross-channel pending-request enumeration remain implementation step 6.
Unsubmitted composer drafts remain in memory and do not survive closing the sidebar.

## Verification

Run from the repository root:

```bash
pnpm vitest:run packages/web-client/src/components/assistant packages/web-client/src/components/todos_view.test.tsx packages/web-client/src/hooks/use_assistant_sidebar.test.ts
pnpm test:unit
pnpm check:commit
```

Tests cover actual assistant-ui rendering, preserved sandbox cancellation, modal dismissal/focus restoration, pending recovery, reconnects, and account isolation.
Live browser review requires the operator's running web development server; the agent does not start it.

See the [web API contract](../../../../../spec/shared_assistant_web_api.md) and [implementation scope](../../../../../spec/shared_assistant_sidebar.md).
