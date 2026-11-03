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

## Compatibility

JSON Schema string bounds count Unicode code points.
Existing Zod string bounds count UTF-16 code units.
Use `validateTextLength` where existing maximum lengths form an external contract.
Minimum lengths above one require separate compatibility checks.

The standard UUID format accepts UUID-shaped hexadecimal strings.
Use `uuidSchema` to preserve existing RFC version and variant constraints.

Format checks do not guarantee parity with existing email, URL, or timestamp rules.
Add boundary-specific fixtures before migrating those formats.

## Migration state

Completed:

- Shared parser, structured errors, explicit normalization and domain-validation hooks.
- Strict internal assistant admission, status, and pending schemas.
- UUID and UTF-16 compatibility coverage.

Remaining:

- Characterize and migrate all other Zod boundaries.
- Implement MCP Standard Schema validation and JSON Schema publication adapters.
- Migrate environment defaults, coercion, object projection, refinements, and transformations.
- Replace Zod-specific error handling and schema-derived types.
- Remove direct dependencies and bundler references after all callers migrate.
- Audit transitive dependencies separately and add an import/dependency guard.
- Run full integration, playback, end-to-end, and bundle verification.

The installed MCP SDK accepts Standard Schema with JSON Schema publication.
Its current application registry remains Zod-specific until that adapter migrates.

## Checks

Run from the repository root:

```bash
pnpm vitest:run packages/core-shared/src/validation packages/assistant-server/src/internal_protocol.test.ts packages/assistant-server/src/internal_handler.test.ts
pnpm check:commit
```
