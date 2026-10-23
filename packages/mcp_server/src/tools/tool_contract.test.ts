import { describe, expect, it } from 'vitest';

import { toolAnnotations, toolFailure, toolOutputSchema, toolResult } from '../tool_contract.js';

const metadata = { operation: 'get', timestamp: '2026-10-23T12:00:00Z' };

describe('structured tool contracts', () => {
  it('preserves payloads and pagination in structured and text results', () => {
    const output = {
      summary: 'Todos',
      data: [{ _id: 'todo', title: 'Task' }],
      metadata,
      pagination: { count: 1, limit: 50, has_more: false },
    };
    const response = toolResult('listTodos', JSON.stringify(output));
    expect(response.structuredContent).toEqual(output);
    expect(response.isError).toBe(false);
    expect(response.content).toEqual([
      { type: 'text', text: JSON.stringify(response.structuredContent) },
    ]);
    expect(toolOutputSchema.safeParse(response.structuredContent).success).toBe(true);
  });

  it('marks domain failures as errors without exposing raw messages', () => {
    const response = toolResult(
      'updateTodo',
      JSON.stringify({
        summary: 'Failed',
        error: 'secret database URL',
        metadata,
      }),
    );
    expect(response.isError).toBe(true);
    expect(JSON.stringify(response)).not.toContain('secret database URL');
    expect(toolOutputSchema.safeParse(response.structuredContent).success).toBe(true);
  });

  it('wraps markdown documentation in a structured envelope', () => {
    const response = toolResult('getServerInfo', '# Documentation');
    expect(response.structuredContent).toMatchObject({ data: { markdown: '# Documentation' } });
    expect(response.isError).toBe(false);
  });

  it('rejects invalid domain envelopes', () => {
    expect(() => toolResult('getTodo', JSON.stringify({ data: [] }))).toThrow();
    expect(() => toolResult('getTodo', 'not JSON')).toThrow();
  });

  it('provides schema-valid safe failures', () => {
    expect(toolFailure('createTodo').isError).toBe(true);
    expect(toolOutputSchema.safeParse(toolFailure('createTodo').structuredContent).success).toBe(
      true,
    );
  });

  it.each(['getTodo', 'listTodos', 'searchTodos', 'getBriefingData', 'getAttachment'])(
    'marks %s read-only and idempotent',
    (name) => {
      expect(toolAnnotations(name)).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    },
  );

  it.each(['createTodo', 'deleteTodo', 'updateTodo', 'startTimeTracking', 'unknownTool'])(
    'never promises unconditional mutation idempotency for %s',
    (name) => {
      expect(toolAnnotations(name)).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      });
    },
  );
});
