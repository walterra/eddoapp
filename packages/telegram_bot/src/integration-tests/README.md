# Agent integration tests

Run all commands from the repository root.

## Durable recovery tests

```bash
pnpm test:integration:durable
```

Starts disposable CouchDB 3.5 and uses Pi's scripted faux provider. No model API keys or live model calls are required.
The shared `test/integration-global-setup.ts` provisions CouchDB before worker setup loads its connection configuration.
No local `.env` file is required. Storage tests retain separate CouchDB 3.5 containers for journal isolation.
Shared global teardown stops the configuration container after the suite.
Covers journal recovery, pending Telegram delivery, shared chat/report context, occurrence deduplication, and printing state.

## VCR-backed behavioral tests

```bash
pnpm test:integration:agent-loop          # auto: replay matching interactions; record missing ones
pnpm test:integration:agent-loop:record   # real provider calls; incurs API charges
pnpm test:integration:agent-loop:playback # strict offline model playback for every native recorded model
```

The runner starts an isolated CouchDB container and MCP server. Tests exercise the production Durable Harness, real MCP tools, and chat projections.
They retain the create, date parsing, context/tag, multi-step, persistent-history, ambiguous-input, and recap scenarios.
The provider adapter records complete native assistant messages, including structured tool calls, rather than translating text protocols.
System-message snapshots retain the first 200 characters plus an ellipsis; user/tool messages and assistant responses remain complete.
The model receives full system instructions, and request hashes use full normalized contents. Only stored system-message previews are shortened.
Snapshots can contain private task data and tool results. Review cassette contents before committing.
Token limits and reasoning effort participate in request hashes; changing generation settings requires matching native recordings.
Both modes expose terminal response streams; partial-stream/restart behavior is covered by the Harness recovery tests.

Set `LLM_MODEL` and provider credentials for record/auto modes. Playback needs no provider credentials.
The wrapper only resolves real credentials when a recording is required. Missing/mismatched playback fails without a source-model call.
Only `Date` is frozen during replay; network timers and the Durable scheduler continue running.
`VCR_DEBUG=1` prints hash diagnostics.

Native cassettes replace legacy recordings in `cassettes/<model>/`; no separate runtime namespace exists.
Anthropic models retain unqualified directory names, such as `claude-sonnet-4-5-20250929`. Other providers use sanitized provider/model names, such as `openai_gpt-5_2`.
Record mode replaces the selected model's recordings. Git retains prior text-protocol versions; incompatible response formats fail validation.
CI always runs behavioral playback. The standalone playback command fails if no model recordings exist.

The completion workflow remains skipped in playback because recorded tool arguments can reference IDs created by a different database run.
All other scenarios verify live test database state rather than exact answer phrasing. Test shutdown verifies that every recorded interaction was consumed.
Review recordings for secrets before committing them; provider credentials and request headers are not recorded.

## VCR infrastructure tests without Docker or API keys

```bash
pnpm vitest:run --config packages/telegram_bot/vitest.integration.config.ts packages/telegram_bot/src/integration-tests/vcr
```

These tests create temporary scripted-provider recordings and verify native tool-call round trips, fail-closed mismatches, immutable playback files, and Harness execution.
They do not create checked-in real-model recordings.
