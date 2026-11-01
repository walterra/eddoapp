// @vitest-environment node
import type { TodoAlpha4 } from '@eddo/core-server';
import type nano from 'nano';
import { describe, expect, it, vi } from 'vitest';
import { createTodoParameters, executeCreateTodo } from './create-todo.js';
import type { ToolContext } from './types.js';
import { storeCapture } from './url_capture_store.js';

vi.mock('./audit-helper.js', () => ({
  logMcpAudit: vi.fn().mockResolvedValue(undefined),
  pushAuditIdToTodo: vi.fn(),
}));

function context(): ToolContext {
  return {
    session: {
      userId: 'alice',
      username: 'alice',
      dbName: 'alice',
      attachmentsDbName: 'attachments',
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe('captured URL todo creation', () => {
  it('persists extracted Markdown and provenance in the actual creation handler', async () => {
    const markdown = '# Page\n\n**Markdown** with [links](https://example.com/a).';
    const reference = storeCapture('alice', {
      sourceUrl: 'https://example.com',
      title: 'Page',
      markdown,
      metadata: { 'web:provider': 'jina-reader', 'web:title': 'Page' },
    });
    const insert = vi.fn().mockResolvedValue({ ok: true });
    const db = { insert } as unknown as nano.DocumentScope<TodoAlpha4>;
    const couch = { db: { get: vi.fn().mockResolvedValue({}) } } as unknown as nano.ServerScope;
    const result = await executeCreateTodo(
      createTodoParameters.parse({
        title: 'Page',
        urlCaptureRef: reference,
        context: 'read-later',
        tags: ['gtd:someday'],
      }),
      context(),
      () => db,
      couch,
    );
    expect(JSON.parse(result).summary).toBe('Todo created successfully');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: markdown,
        link: 'https://example.com',
        metadata: { 'web:provider': 'jina-reader', 'web:title': 'Page' },
      }),
    );
  });

  it('does not insert when a capture is missing after restart or eviction', async () => {
    const insert = vi.fn();
    const db = { insert } as unknown as nano.DocumentScope<TodoAlpha4>;
    const couch = { db: { get: vi.fn().mockResolvedValue({}) } } as unknown as nano.ServerScope;
    await expect(
      executeCreateTodo(
        createTodoParameters.parse({
          title: 'Page',
          urlCaptureRef: 'a4eb6e51-20c6-43ea-8a5b-7a205c983339',
        }),
        context(),
        () => db,
        couch,
      ),
    ).rejects.toThrow('fetch the URL again');
    expect(insert).not.toHaveBeenCalled();
  });
});
