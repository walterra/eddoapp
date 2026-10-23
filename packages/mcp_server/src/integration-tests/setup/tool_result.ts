import type { CallToolResult } from '@modelcontextprotocol/client';

/** Extracts domain envelopes while retaining SDK-level validation errors. */
export function requireStructuredResult(result: CallToolResult, name: string): object {
  const output = result.structuredContent;
  if (output && typeof output === 'object' && !Array.isArray(output)) return output;
  if (result.isError) {
    const message = result.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    throw new Error(message || `Tool ${name} rejected the request`);
  }
  throw new Error(`Tool ${name} returned no structured result`);
}
