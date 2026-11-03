# Boundary validation

`schema_parser.ts` wraps `@earendil-works/pi-schema` with application parsing and diagnostics.

```typescript
import { createSchemaParser, obj, str } from '@eddo/core-shared/validation/schema_parser';

const request = createSchemaParser(obj({ title: str({ minLength: 1 }) }));
const value = request.parse(input);
```

## Contracts

- Compile static schemas once at module initialization.
- Reject unknown properties unless a boundary explicitly projects them.
- Keep general coercion disabled.
- Supply defaults and conversions through explicit normalization.
- Apply structural validation before domain validation.
- Perform output transformations outside the parser.
- Use `SchemaValidationError` for validation failures; propagate programming errors.
- Return safe issue messages without rejected values or credentials.

`safeParse` returns `{ success: true, data }` or `{ success: false, error }`.
Issues contain JSON Pointer `path`, `code`, and `message` fields.
The parser configures pi-schema's format checks explicitly.
HTTP validation details use array paths, category codes, and safe messages without validator-specific metadata.

## Normalization

`projectProperties` selects own fields without mutating input.
It preserves non-object values so structural validation rejects them.

`createObjectProjection` projects nested inline object schemas, array items, and union branches.
It requires inline schemas and never supplies defaults or coerces values.
Use it only at boundaries that intentionally strip undeclared fields.
`createProjectedParser` combines structural parsing with recursive field projection.

`createFieldNormalizer` projects named fields and supplies cloned defaults for undefined values.
Its conversions apply only to explicitly configured fields.
Set `preserveUnknown` when strict boundaries reject undeclared fields after normalization.
`coerceNumber` preserves JavaScript numeric conversion; structural validation rejects failed conversions.

Defaults remain annotations in ordinary pi-schema validation.
The MCP parameter adapter explicitly applies top-level field defaults before validation.
Other boundaries supply defaults through their own normalizers.

Backup scripts import shared validation source to remain runnable through tsx before an application build.

## MCP contracts

`toStandardSchema` preserves parser methods and adds Standard Schema validation and JSON Schema publication.
It supports draft 2020-12 publication and decodes JSON Pointer paths into Standard Schema segments.
Publication overrides distinguish accepted inputs from normalized outputs.
The MCP SDK validates arguments before executing registered handlers.

`packages/mcp_server/src/tool_parameters.ts` derives validation, defaults, and publication from one canonical schema.
Its published inputs allow undeclared fields because parsing strips them.
Defaulted fields remain optional in published inputs and required in normalized outputs.
The publication adapter preserves string-enum and string-record schemas and omits runtime-only finite-number bounds.
Domain refinements, including timezone checks, run after structural validation.

Preserve serialized schema and result key order: native VCR request hashes depend on those bytes.
`tool_field.ts` preserves wrapper annotation ordering without a fluent compatibility API.
`tools/fixtures/tool_input_contracts.json` records pre-migration input contracts for byte-level regression tests.

## Compatibility

JSON Schema string bounds count Unicode code points.
The previous application validators counted UTF-16 code units.
Use `validateTextLength` and `validateMinimumTextLength` where existing limits form an external contract.
Native `minLength` above one also requires adjustment when preserving UTF-16 acceptance.

The standard UUID format accepts UUID-shaped hexadecimal strings.
Use `uuidSchema` to preserve RFC version and variant constraints.
`utcDateTimeSchema` preserves UTC-only timestamps, mandatory seconds, and calendar validation.
`emailSchema` preserves the practical ASCII email contract.
`validateAbsoluteUrl` validates absolute URLs without exposing rejected values.

Application `num` rejects non-finite numbers; `int` also rejects integers outside JavaScript's exact representation range.
Native pi-schema number checks accept non-finite JavaScript values without explicit bounds.
Use the application builders at application boundaries.

## Dependency policy

Application packages and maintained scripts have no direct Zod imports or dependencies.
`pnpm check:no-zod` audits package/script source and root/package manifests.
It checks static imports, type imports, re-exports, dynamic imports, CommonJS requires, and npm dependency aliases.
It excludes generated output, dependency directories, ordinary fixture strings, and lockfile-only transitive dependencies.
The unit suite and commit checks run this policy automatically.

Upstream MCP, assistant-ui, model-provider SDKs, and development tools still depend on Zod.
Those transitive dependencies remain owned by their upstream packages.
Do not remove their lockfile entries or override them with pi-schema.
Inspect the current dependency graph with `pnpm why zod -r`.
Historical design notes and reviews retain references to the previous implementation.

## Checks

Run from the repository root:

```bash
pnpm check:no-zod
pnpm test:unit
pnpm vitest:run packages/core-client/src/config/client-env.test.ts
pnpm test:integration:mcp-server
pnpm test:integration:durable
pnpm test:integration:backup
pnpm test:integration:agent-loop:playback
pnpm test:e2e
pnpm build
pnpm check:commit
```
