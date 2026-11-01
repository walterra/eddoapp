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
The shared-assistant release suite connects real JWT routes, internal payload serialization, registry authorization, projections, and native CouchDB journals.
It verifies channel continuity, interrupted projection recovery, credential rotation/revocation, `/new` retry identity, and account isolation.
Model, Telegram, printing, and external MCP effects use scripted/test adapters; no live provider or Telegram account is required.
CouchDB replay checks compare invalidation sets and cursor coverage, not unstable cross-shard event order.
See [shared assistant operations](../../../../docs/shared-assistant-operations.md) for deployment and manual browser acceptance.

## Qualitative recording review

Run a paid reviewer after recording. No Docker, MCP server, or replay is required.

```bash
pnpm eval:recordings --model anthropic/claude-sonnet-4-5-20250929
pnpm eval:recordings --model openai/gpt-5.2 --staged
```

Set the reviewer's provider credentials as for recording. `EVAL_MODEL` supplies the model when `--model` is absent.
The command reviews both subject models by default. `--staged` reads changed recordings from the Git index, not later working-tree edits.

Each recording gets one reviewer call. The reviewer submits a schema-defined tool result; the command never executes recorded tools.
The five checks cover task fulfillment, supported claims, user instructions, error recovery, and clear communication.
Verdicts are `pass`, `partial`, `fail`, `not_applicable`, or `insufficient_evidence`. Explanations use plain language.
System snapshots are shortened in cassettes, so reviews assess explicit user instructions rather than reconstructing missing system policies.

Reports overwrite the same files in `eval-reports/` so Git tracks changes between runs. Review reports for secrets before committing them. `--out <directory>` selects another repository-relative or absolute location.

- `review.json`: Findings, source events, cassette hashes, reviewer model, and rubric version/hash.
- `review.md`: One row per scenario comparing models, followed by concerns only. Full evidence stays in JSON.
- `judge-response.schema.json`: Version 1 JSON Schema for reviewer submissions.

The command validates criteria and evidence IDs. Invalid responses and provider failures produce error entries and exit code 1.
A completed review can contain failed judgments; qualitative findings do not act as CI gates.
Reviewing sends visible conversation and tool-result data to the selected provider. Use test recordings without secrets.
Private reasoning and provider accounting are excluded. Reviews do not prove database persistence or replay compatibility.

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
Discovered tool schemas and model-facing structured payloads also participate in transcript hashes.
The MCP v2 migration changes these contracts; pre-migration recordings require paid re-recording for each subject model.
Never rewrite stored hashes or weaken matching to reuse incompatible recordings.
Obtain approval before running record/auto mode, then verify strict playback for every recorded model.
Both modes expose terminal response streams; partial-stream/restart behavior is covered by the Harness recovery tests.

Set `LLM_MODEL` and provider credentials for record/auto modes. Playback needs no provider credentials.

### Custom OpenAI-compatible recording models

Set `EDDO_MODELS_FILE` to an explicitly trusted Pi `models.json` file.
The VCR harness loads only the provider selected by `LLM_MODEL=provider/model`.
Custom loading currently supports `openai-completions`; it does not load Pi extensions or OAuth credentials.
Production bot configuration and recording-reviewer model loading remain unchanged.

Run from the repository root with Docker available:

```bash
EDDO_MODELS_FILE="$HOME/.pi/agent/models.json" \
LLM_MODEL=qwen38/qwen3.8-27b \
pnpm test:integration:agent-loop:record
```

The provider supplies `baseUrl`, `api`, optional `name`, `apiKey`, `compat`, and `models`.
Models support `id`, `name`, `reasoning`, `input`, `contextWindow`, `maxTokens`, `cost`, `thinkingLevelMap`, and `compat`.
Model compatibility settings override matching provider settings.
Supported compatibility fields:

- `supportsStore`, `supportsDeveloperRole`, `supportsReasoningEffort`, `supportsUsageInStreaming`, and `supportsStrictMode`.
- `requiresReasoningContentOnAssistantMessages` and `maxTokensField`.
- `thinkingFormat`: `openai`, `qwen`, `qwen-chat-template`, `chat-template`, or `deepseek`.

Unsupported fields fail validation rather than silently changing request behavior.
API keys accept literals, `$VARIABLE`, `${VARIABLE}`, or Pi's `!command` syntax.
Credential commands execute only when live generation starts, with a ten-second timeout.
Only load trusted configuration: credential commands execute with the test process's permissions.

Record and auto modes write a credential-free `.model-config` sidecar beside the selected model's cassettes.
Review and commit that sidecar together with the recordings.
It retains the endpoint, model capabilities, reasoning mappings, and compatibility settings.
It excludes API keys, credential commands, authentication headers, and unrelated providers.
Review endpoint paths for confidential information before committing.

```bash
pnpm test:integration:agent-loop:playback
```

Playback loads custom models from their sidecars and ignores `EDDO_MODELS_FILE`.
It requires neither GX10 access nor local credential files.
Re-recording requires the trusted configuration again; the sidecar cannot authorize live requests.
The wrapper only resolves real credentials when a recording is required. Missing/mismatched playback fails without a source-model call.
Only `Date` is frozen during replay; network timers and the Durable scheduler continue running.
`VCR_DEBUG=1` prints hash diagnostics.

Native cassettes replace legacy recordings in `cassettes/<model>/`; no separate runtime namespace exists.
Anthropic models retain unqualified directory names, such as `claude-sonnet-4-5-20250929`. Other providers use sanitized provider/model names, such as `openai_gpt-5_2`.
The shared cassette writer applies repository Prettier configuration before saving recordings in record and auto modes.
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
