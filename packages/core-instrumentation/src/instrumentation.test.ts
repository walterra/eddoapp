import { describe, expect, it } from 'vitest';

import { SpanAttributes, withSpan } from './instrumentation.js';

describe('SpanAttributes', () => {
  it('exports expected attribute keys', () => {
    expect(SpanAttributes.USER_ID).toBe('user.id');
    expect(SpanAttributes.TODO_ID).toBe('todo.id');
    expect(SpanAttributes.MCP_TOOL).toBe('mcp.tool');
    expect(SpanAttributes.GITHUB_REPO).toBe('github.repo');
    expect(SpanAttributes.HTTP_METHOD).toBe('http.method');
  });
});

describe('withSpan', () => {
  it('executes synchronous function and returns result', () => {
    const result = withSpan('test_operation', {}, () => {
      return 42;
    });

    expect(result).toBe(42);
  });

  it('executes async function and returns result', async () => {
    const result = await withSpan('test_async_operation', {}, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'async result';
    });

    expect(result).toBe('async result');
  });

  it('propagates synchronous errors', () => {
    expect(() => {
      withSpan('test_error', {}, () => {
        throw new Error('Test error');
      });
    }).toThrow('Test error');
  });

  it('propagates async errors', async () => {
    await expect(
      withSpan('test_async_error', {}, async () => {
        throw new Error('Async test error');
      }),
    ).rejects.toThrow('Async test error');
  });

  it('accepts attributes', () => {
    const result = withSpan(
      'test_with_attrs',
      {
        [SpanAttributes.USER_ID]: '123',
        [SpanAttributes.TODO_COUNT]: 5,
      },
      () => 'success',
    );

    expect(result).toBe('success');
  });

  it('provides span to callback function', () => {
    let spanReceived = false;

    withSpan('test_span_callback', {}, (span) => {
      spanReceived = span !== undefined;
      return null;
    });

    expect(spanReceived).toBe(true);
  });
});
