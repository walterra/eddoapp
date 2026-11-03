# Shared assistant operations

Runs the main-app Assistant sidebar and Telegram through the same per-account Pi Durable conversation.
Sandbox/container chats remain independent.

## Required services

- Web client and authenticated web-api.
- CouchDB, including user registry, chat projections, and private execution journals.
- MCP service and current per-account MCP credentials.
- Exactly one assistant owner: the existing Telegram process, with optional Telegram polling.
- Server-side model credentials and `LLM_MODEL` configuration.

Static browser hosting alone does not provide assistant execution.
The owner and web-api require the same host/network namespace for the loopback transport.
Separate containers do not share `127.0.0.1`; remote host routing is unsupported.

## Configuration

Set matching server-only values in web-api and the owner:

```bash
ASSISTANT_INTERNAL_TOKEN=<independent-secret-of-at-least-32-characters>
ASSISTANT_INTERNAL_PORT=3003
```

Generate the secret with `openssl rand -hex 32`. Never expose it through Vite variables or browser bundles.
Configure model/provider credentials in the owner, not the sidebar's browser preferences.
Browser provider-key preferences belong to sandbox chats and do not configure this assistant.

Configure `TELEGRAM_BOT_TOKEN` when polling, scheduled Telegram reports, or recovering Telegram deliveries are required.
Omit the variable for web-only hosting. Linked accounts retain their existing journal ownership pins.
Linking or unlinking Telegram requires the reviewed migration in [Durable operations](../spec/durable_telegram_operations.md#telegram-identity-changes).

The operator starts development services from the repository root:

```bash
pnpm dev                 # Web client, API, and MCP service
pnpm dev:telegram-bot    # Sole assistant owner; separate terminal
```

Do not start a second owner when the existing supervisor already runs one.
The coding agent does not start, restart, or stop these development services.

## Custom models on the assistant owner

Set these server-only variables to select a trusted Pi-compatible provider configuration:

```bash
EDDO_MODELS_FILE=/absolute/path/to/models.json
LLM_MODEL=qwen38/qwen3.8-27b
LLM_MAX_TOKENS=4096
LLM_REASONING_EFFORT=low
```

The shared loader supports OpenAI Chat Completions providers with `api: "openai-completions"`.
It loads only the selected provider and model; unrelated Pi providers and extensions remain unloaded.
Without `EDDO_MODELS_FILE`, built-in provider behavior remains unchanged.
Web chat, Telegram chat, and scheduled reports use the same configured model collection.

For GX10, reuse the trusted Pi configuration containing the Qwen endpoint and compatibility settings.
Alternatively, provision a server-owned configuration:

```json
{
  "providers": {
    "qwen38": {
      "api": "openai-completions",
      "baseUrl": "http://192.168.1.169:30001/v1",
      "apiKey": "$QWEN_API_KEY",
      "compat": {
        "supportsStore": false,
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": true,
        "supportsUsageInStreaming": true,
        "maxTokensField": "max_tokens",
        "supportsStrictMode": false,
        "thinkingFormat": "openai",
        "requiresReasoningContentOnAssistantMessages": true
      },
      "models": [
        {
          "id": "qwen3.8-27b",
          "reasoning": true,
          "input": ["text", "image"],
          "contextWindow": 262144,
          "maxTokens": 64000,
          "thinkingLevelMap": {
            "off": null,
            "minimal": "low",
            "low": "low",
            "medium": "medium",
            "high": "xhigh",
            "xhigh": "xhigh",
            "max": "xhigh"
          }
        }
      ]
    }
  }
}
```

Supply `QWEN_API_KEY` through the owner's secret environment; do not commit its value.
The configured model limits describe endpoint capabilities; `LLM_MAX_TOKENS` controls the requested answer budget.
Unknown configuration fields fail validation rather than silently changing request behavior.
See the [supported schema](../packages/telegram_bot/src/ai/custom_model_schema.ts) for accepted fields.

Only load trusted, operator-controlled files.
API keys support literals, environment interpolation, and Pi's `!command` credential syntax.
Commands execute with owner permissions and a ten-second timeout.
Credential validation runs before journal recovery and repeats when opening user runtimes and sending model requests.
The configuration file loads at process startup; credential expressions resolve again when authentication runs.

Containers require read-only configuration and credential mounts with container-visible paths.
The owner must reach the configured endpoint; never expose model credentials to the browser.
Production does not read or write VCR sidecars and does not depend on recording helpers.

Stop the existing owner before restarting it with these settings.
Follow the deployment sequence below; never run two owners against the same journals.

## Deploy and restart

1. Run `pnpm check:commit`, `pnpm test:unit`, and `pnpm test:integration:durable`.
2. Build with `pnpm build`; verify model credentials, MCP access, and matching internal secrets.
3. Verify coordinated backups include registry, todos, chat projections, runtime journals, and MCP mutation receipts.
4. Stop the previous owner through its supervisor. Confirm termination across all deployments sharing these databases.
5. Start exactly one replacement owner against the same database prefix and account identities.
6. Deploy or restart web-api and the client from the same revision.
7. Inspect startup and recovery with `pnpm logs:tail` under the unified launcher.
8. Verify header-authenticated history, submission, pending discovery, and stream reconnects.

Keep a stop-first owner deployment. Listener port exclusivity does not fence writers on other hosts.
Startup backfills pending identities before recovered tasks resume; startup time depends on existing journal history.
Do not edit journal documents, delete deduplication receipts, or start another owner to accelerate recovery.

Forward `Authorization` and `Last-Event-ID` through reverse proxies.
Disable response caching and SSE buffering. Permit streaming connections for the five-minute server lifetime.
Use HTTPS outside localhost; browser submission requires secure-context cryptography and available localStorage.

## Verify the user experience

Complete these checks against an operator-started deployment and a dedicated test account:

- Open Assistant from the todo header; verify the docked panel on desktop and narrow screens while editing a todo beside it.
- Check dark mode, Markdown, keyboard navigation, Escape dismissal, and restored trigger focus.
- Toggle Activity and sandbox Chat independently; confirm sandbox session and cancellation controls remain unchanged.
- Send a Telegram message, continue in the sidebar, then ask Telegram about that exchange.
- Close or reload during accepted work; confirm one logical message and one mutation, without generating a replacement UUID.
- Open a second browser session without pending local state; confirm shared activity appears.
- Disconnect and reconnect the stream; verify missed history without duplicate messages.
- Use Cancel request during queued or active web work; verify other accepted requests continue.
- Cancel an unconfirmed submission; verify late admission never executes it, including after owner restart.
- Interrupt cancellation transport and reload; verify Retry cancellation never resubmits the original message.
- Use Telegram `/new`; verify the active thread changes and earlier pending work stays separate.
- Switch accounts and sign out; confirm no other account's history or activity appears.
- Confirm web-origin requests never emit Telegram replies, typing, or tool-progress notices.

Live-model checks incur provider charges. Prefer scripted-provider integration tests for automated verification.
Do not send mutation prompts to a production account for smoke testing.

## Recovery and troubleshooting

| Symptom                                 | Action                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| History works; submission returns `503` | Check owner availability, model/MCP initialization, and matching internal secrets.                                         |
| Admission response lost                 | Query the original durable ID or explicitly retry the same UUID; never mint a replacement automatically.                   |
| User text appears without an answer     | Check request status; accepted projection precedes generation and does not establish success.                              |
| Reply appears before Telegram delivery  | Expected: history persists before transport. Check durable delivery status before assuming Telegram or printing succeeded. |
| Projection unavailable                  | Restore chat database access. Accepted projection gates generation; answer projection gates Telegram sending.              |
| Sidebar reports an earlier conversation | Work retains its original conversation after `/new`; do not insert or resubmit it into the new thread.                     |
| Pending discovery sets `hasMore`        | Continue normal polling. Snapshots contain at most 100 entries, not an exact account-wide total.                           |
| `401` or `403`                          | Sign in again or verify active status, current MCP credentials, and unchanged Telegram ownership pins.                     |
| Rate limited                            | Honor `Retry-After`; do not add parallel streams or retry admission with new IDs.                                          |
| Browser storage or secure-context error | Restore storage access or use HTTPS/localhost before sending. Preserve unresolved pending records.                         |
| Mutation failed or outcome unknown      | Inspect current todo, audit, and mutation-receipt state before repeating the operation.                                    |

Closing the sidebar cancels read transports, never accepted work.
Use **Cancel request** to stop the locally tracked web request through its existing owner.
Unconfirmed submissions receive a persisted cancellation fence; deleting localStorage does not provide cancellation.
Keep the pending identity until the owner confirms a terminal outcome; retry failed cancellation with **Retry cancellation**.
Cancellation cannot undo completed tool actions or external effects already in flight.
SSE resumes history invalidations and refreshes pending snapshots; it does not replay tool execution or stream private reasoning.
History and lifecycle snapshots are separate: a pending-count change alone does not prove a mutation's outcome.

Pending browser records retain unresolved text per account in localStorage without encryption.
Logout keeps unresolved records for recovery. Completed records clear after their assistant projection appears.
Do not clear these records to resolve an unknown admission outcome.

## Rollback

Stop all owners and preserve the current databases before considering an older binary.
Do not assume unchanged task names or versions establish checkpoint compatibility.
The accepted-projection checkpoint, pending index, and cancellation fences are additive.
Older owners ignore cancellation fences and can resume work that this version stops.
Do not roll back cancelled journals without a reviewed compatibility procedure.
Rollback and re-upgrade require a reviewed pending-index reconciliation procedure; no automatic downgrade workflow exists.
Prefer rolling forward with the same owner implementation while repairing transport or projection access.
Never restore only chat history or selected journal records to roll back execution.

Follow [backup and restore restrictions](../spec/durable_telegram_operations.md#back-up-and-restore) before restoring complete reviewed backups.
Account for external effects since the backup; older receipts can permit duplicated mutations or delivery.

## Automated evidence

`pnpm test:integration:durable` uses disposable CouchDB and scripted model providers without paid API calls.
Its release-boundary suite exercises real JWT routes, serialized internal HTTP payloads, registry authorization, projections, and native journals.
Transport runs in-process in that suite; separate transport tests cover the loopback listener.
Telegram sends, printing, and external MCP effects use bounded test adapters, not live services.

Coverage includes:

- Telegram → web → Telegram → scheduled-report context continuity.
- Projection interruption and owner reopening without repeated mutation or generation.
- Accepted text, reply reconciliation, pending discovery, and replayed SSE invalidations.
- Rotated MCP credentials and revoked web-only accounts before mutation.
- Stable retry identity across `/new` and cross-account status/cursor rejection.
- CouchDB replay invariants independent of cross-shard event order, including partial-cursor resume.

These tests do not replace live browser acceptance or prove distributed ownership/failover.
See the [host contract](../spec/shared_assistant_host.md), [browser API](../spec/shared_assistant_web_api.md), and [sidebar runtime](../packages/web-client/src/components/assistant/README.md).
