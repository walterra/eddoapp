import { jsonValueSchema } from '@eddo/core-shared/validation/json_value';
import { createObjectProjection } from '@eddo/core-shared/validation/object_projection';
import {
  arr,
  bool,
  createSchemaParser,
  int,
  obj,
  opt,
  projectProperties,
  str,
  type Static,
} from '@eddo/core-shared/validation/schema_parser';
import { toStandardSchema } from '@eddo/core-shared/validation/standard_schema';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/server';

const metadataSchema = obj({ operation: str(), timestamp: str() }, { open: true });
const paginationSchema = obj({
  count: int({ minimum: 0 }),
  limit: int({ minimum: 1 }),
  has_more: bool(),
});
const projectPagination = createObjectProjection(paginationSchema);

/** Validates the shared response envelope without narrowing existing domain payloads. */
const outputDefinition = obj({
  summary: str(),
  data: opt(jsonValueSchema),
  error: opt(str()),
  recovery_suggestions: opt(arr(str())),
  pagination: opt(paginationSchema),
  metadata: metadataSchema,
});
const outputParser = createSchemaParser(outputDefinition, {
  normalize: normalizeOutput,
});
export const toolOutputSchema = toStandardSchema(outputParser);
type ToolOutput = Static<typeof outputDefinition>;

/** Projects envelope fields while retaining arbitrary JSON data and open metadata. */
function normalizeOutput(value: unknown): unknown {
  const projected = projectProperties(value, [
    'summary',
    'data',
    'error',
    'recovery_suggestions',
    'pagination',
    'metadata',
  ]);
  if (typeof projected !== 'object' || projected === null || Array.isArray(projected))
    return projected;
  const output = { ...projected, metadata: normalizeMetadata(Reflect.get(projected, 'metadata')) };
  if (!Object.hasOwn(projected, 'pagination')) return output;
  return { ...output, pagination: projectPagination(Reflect.get(projected, 'pagination')) };
}

/** Preserves declared-field ordering before open metadata for native transcript compatibility. */
function normalizeMetadata(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const declared = Object.fromEntries(
    ['operation', 'timestamp']
      .filter((key) => Object.hasOwn(value, key))
      .map((key) => [key, Reflect.get(value, key)]),
  );
  return { ...declared, ...value };
}

const readTools = new Set([
  'fetchUrl',
  'listTodos',
  'getTodo',
  'getActiveTimeTracking',
  'listAttachments',
  'getAttachment',
  'searchTodos',
  'getUserInfo',
  'getServerInfo',
  'getBriefingData',
  'getRecapData',
]);

/** Treats mutations as non-idempotent because operation receipts remain optional. */
export function toolAnnotations(name: string): ToolAnnotations {
  const readOnlyHint = readTools.has(name);
  return {
    readOnlyHint,
    destructiveHint: !readOnlyHint,
    idempotentHint: readOnlyHint,
    openWorldHint: name === 'fetchUrl',
  };
}

/** Creates a safe failure result without exposing database or transport exceptions. */
export function toolFailure(name: string, summary = 'Tool execution failed'): CallToolResult {
  return result({
    summary,
    error: 'Operation failed; inspect state before retrying mutations.',
    metadata: { operation: name, timestamp: new Date().toISOString() },
  });
}

function result(output: ToolOutput): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(output) }],
    structuredContent: output,
    isError: output.error !== undefined,
  };
}

/** Converts domain JSON or server documentation into a validated MCP result. */
export function toolResult(name: string, text: string): CallToolResult {
  if (name === 'getServerInfo') {
    return result({
      summary: 'Server information retrieved',
      data: { markdown: text },
      metadata: { operation: 'server_info', timestamp: new Date().toISOString() },
    });
  }
  const parsed: unknown = JSON.parse(text);
  const output = outputParser.parse(parsed);
  if (output.error !== undefined) return toolFailure(name, output.summary);
  return result(output);
}
