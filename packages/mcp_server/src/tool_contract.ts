import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/server';
import { z } from 'zod';

const metadataSchema = z.looseObject({
  operation: z.string(),
  timestamp: z.string(),
});

/** Validates the shared response envelope without narrowing existing domain payloads. */
export const toolOutputSchema = z.object({
  summary: z.string(),
  data: z.json().optional(),
  error: z.string().optional(),
  recovery_suggestions: z.array(z.string()).optional(),
  pagination: z
    .object({
      count: z.number().int().nonnegative(),
      limit: z.number().int().positive(),
      has_more: z.boolean(),
    })
    .optional(),
  metadata: metadataSchema,
});

type ToolOutput = z.infer<typeof toolOutputSchema>;

const readTools = new Set([
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
    openWorldHint: false,
  };
}

/** Creates a safe failure result without exposing database or transport exceptions. */
export function toolFailure(name: string): CallToolResult {
  return result({
    summary: 'Tool execution failed',
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
  const output = toolOutputSchema.parse(parsed);
  if (output.error !== undefined) return toolFailure(name);
  return result(output);
}
