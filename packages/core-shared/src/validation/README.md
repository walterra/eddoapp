# Boundary validation

`schema_parser.ts` wraps `@earendil-works/pi-schema` with application parsing and diagnostics.

```typescript
import { createSchemaParser, obj, str } from '@eddo/core-shared/validation/schema_parser';

const request = createSchemaParser(obj({ title: str({ minLength: 1 }) }));
const value = request.parse(input);
```

## Contracts

- Compile each static schema once at module initialization.
- Reject unknown properties unless a boundary explicitly projects them.
- Keep general coercion disabled.
- Supply defaults and conversions through explicit normalization.
- Apply structural validation before domain validation.
- Perform output transformations outside the parser.
- Use `SchemaValidationError` for validation failures; propagate programming errors.
- Return safe issue messages without rejected values or credentials.
- Use `parser.schema` when publishing JSON Schema.

`safeParse` returns `{ success: true, data }` or `{ success: false, error }`.
Issues contain JSON Pointer `path`, `code`, and `message` fields.
The parser configures pi-schema's format checks explicitly.

`projectProperties` selects own fields without mutating input.
It preserves non-object values so structural validation rejects them.

`createObjectProjection` projects nested inline object schemas, array items, and union branches.
It requires inline schemas and never supplies defaults or coerces values.
Use it only at boundaries that intentionally strip undeclared fields.

`createFieldNormalizer` projects named fields and supplies cloned defaults for undefined values.
Its conversions apply only to explicitly configured fields.
Set `preserveUnknown` when strict boundaries reject undeclared fields after normalization.
`createProjectedParser` combines structural parsing with recursive field projection.
`coerceNumber` preserves JavaScript numeric conversion; structural validation rejects failed conversions.

`toStandardSchema` preserves parser methods and adds Standard Schema validation and JSON Schema publication.
It supports draft 2020-12 publication and decodes JSON Pointer paths into Standard Schema segments.
The MCP SDK validates arguments before executing registered handlers.
Publication overrides distinguish accepted inputs from normalized outputs.
MCP derives open input schemas from strip-on-parse object schemas.
Preserve serialized schema and result key order: native VCR request hashes depend on those bytes.

## Compatibility

JSON Schema string bounds count Unicode code points.
Existing Zod string bounds count UTF-16 code units.
Use `validateTextLength` where existing maximum lengths form an external contract.
Minimum lengths above one require separate compatibility checks.

The standard UUID format accepts UUID-shaped hexadecimal strings.
Use `uuidSchema` to preserve existing RFC version and variant constraints.

`utcDateTimeSchema` preserves UTC-only timestamp constraints, including mandatory seconds and calendar validation.
Format checks do not guarantee parity with existing email or URL rules.
Add boundary-specific fixtures before migrating those formats.

Application `num` rejects non-finite numbers; `int` also rejects integers outside JavaScript's exact representation range.
Native pi-schema number checks accept non-finite JavaScript values without explicit bounds.
Use the application builders at migrated boundaries.

## Migration state

Completed:

- Shared parser, structured errors, explicit normalization and domain-validation hooks.
- All assistant-server validation, including requests and generation controls.
- Shared server and client environment parsing with explicit defaults and conversions.
- Direct Zod dependency removal from the root package and all application packages except mcp-server.
- Web assistant authentication, routes, cursors, receipts, projection reads, and host transport configuration.
- Browser assistant payloads and persisted pending state, with shared lifecycle receipt contracts.
- Recording evaluation schemas, JSON Schema publication, and native VCR response validation.
- Transport-independent MCP registry using Standard Schema and pi-schema output contracts.
- Get, delete, user-info, briefing, recap, and URL-fetch tool argument schemas.
- Mutation receipt and journal ownership metadata validation.
- Bot and printer configuration with pure parsers, explicit defaults, and legacy string-boolean conversion.
- Custom provider/model configuration and credential-free portable VCR model metadata.
- Legacy archive query arguments and offset defaults.
- General web API authentication, users, search, audit, chat, and Graphviz request validation.
- MCP Reader configuration and response projection.
- Backup archive, attachment, metadata, transport, and restore validation.

Backup scripts import shared validation source to remain runnable through tsx before an application build.
HTTP validation details retain array paths, category codes, and safe messages without validator-specific metadata.

- UUID, timestamp, UTF-16, finite-number, and safe-integer compatibility coverage.

Remaining:

- Characterize and migrate all other Zod boundaries.
- Migrate remaining MCP tool arguments, including input defaults and custom refinements.
- Remove direct dependencies and bundler references after all callers migrate.
- Audit transitive dependencies separately and add an import/dependency guard.
- Run final end-to-end and browser bundle comparisons after all boundaries migrate.

Verification commands cover unit tests, production builds, MCP integration, Durable integration, and all recorded-model playback sets.
The root unit suite includes the pure bot and printer configuration parsers.

The MCP registry accepts both migrated pi-schema adapters and remaining Zod Standard Schema implementations.
This transitional compatibility allows incremental migration without a second transport implementation.

## Checks

Run from the repository root:

```bash
pnpm test:unit
pnpm vitest:run packages/core-client/src/config/client-env.test.ts
pnpm test:integration:mcp-server
pnpm test:integration:durable
pnpm test:integration:backup
pnpm test:integration:agent-loop:playback
pnpm build
pnpm check:commit
```
