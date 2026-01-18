/**
 * Tests for searchTodos MCP tool
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import type { Client } from '@elastic/elasticsearch';
import type nano from 'nano';
import { describe, expect, it, vi } from 'vitest';

import { executeSearchTodos, type SearchTodosArgs } from './search-todos.js';
import type { ToolContext, UserSession } from './types.js';

/** Creates a mock tool context */
function createMockContext(session: UserSession | undefined): ToolContext {
  return {
    session,
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

/** Creates a mock ES client that returns IDs and scores only */
function createMockEsClient(hits: Array<{ todoId: string; _score: number }>): Client {
  return {
    esql: {
      query: vi.fn().mockResolvedValue({
        columns: [
          { name: 'todoId', type: 'keyword' },
          { name: '_score', type: 'float' },
        ],
        values: hits.map((h) => [h.todoId, h._score]),
      }),
    },
  } as unknown as Client;
}

/** Creates a mock CouchDB that returns full todos */
function createMockCouchDb(todos: TodoAlpha3[]): nano.DocumentScope<TodoAlpha3> {
  const todoMap = new Map(todos.map((t) => [t._id, t]));
  return {
    fetch: vi.fn().mockResolvedValue({
      rows: todos.map((t) => ({ id: t._id, doc: t })),
    }),
    get: vi.fn().mockImplementation((id: string) => {
      const todo = todoMap.get(id);
      if (todo) return Promise.resolve(todo);
      return Promise.reject(new Error('not_found'));
    }),
  } as unknown as nano.DocumentScope<TodoAlpha3>;
}

/** Creates a mock todo */
function createMockTodo(overrides: Partial<TodoAlpha3> = {}): TodoAlpha3 {
  return {
    _id: 'todo-1',
    _rev: '1-abc',
    version: 'alpha3',
    title: 'Test todo',
    description: 'Test description',
    context: 'work',
    tags: ['gtd:next'],
    due: '2026-01-20T00:00:00.000Z',
    completed: null,
    active: {},
    repeat: null,
    link: null,
    notes: [],
    ...overrides,
  };
}

describe('executeSearchTodos', () => {
  const mockGetUserDb = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when ES client is not available', async () => {
    const context = createMockContext({
      userId: 'user_test',
      dbName: 'eddo_user_test',
      attachmentsDbName: 'eddo_attachments_test',
      username: 'test',
    });
    const args: SearchTodosArgs = { query: 'meeting', limit: 20, includeCompleted: true };

    const result = await executeSearchTodos(args, context, () => null, mockGetUserDb);
    const parsed = JSON.parse(result);

    expect(parsed.summary).toBe('Search unavailable');
    expect(parsed.error).toContain('not configured');
  });

  it('returns error when no user session', async () => {
    const context = createMockContext(undefined);
    const esClient = createMockEsClient([]);
    const args: SearchTodosArgs = { query: 'meeting', limit: 20, includeCompleted: true };

    const result = await executeSearchTodos(args, context, () => esClient, mockGetUserDb);
    const parsed = JSON.parse(result);

    expect(parsed.summary).toBe('Authentication required');
  });

  it('searches ES then fetches full docs from CouchDB', async () => {
    const context = createMockContext({
      userId: 'user_test',
      dbName: 'eddo_user_test',
      attachmentsDbName: 'eddo_attachments_test',
      username: 'test',
    });

    const todo1 = createMockTodo({
      _id: 'todo-1',
      title: 'Meeting notes',
      description: 'Team standup discussion',
      notes: [{ id: 'n1', content: 'Important point', createdAt: '2026-01-18T10:00:00Z' }],
      metadata: { source: 'manual' },
    });
    const todo2 = createMockTodo({
      _id: 'todo-2',
      title: 'Review meeting agenda',
      description: 'Prep for sync',
      blockedBy: ['todo-3'],
    });

    const esClient = createMockEsClient([
      { todoId: 'todo-1', _score: 5.2 },
      { todoId: 'todo-2', _score: 3.1 },
    ]);
    const couchDb = createMockCouchDb([todo1, todo2]);
    mockGetUserDb.mockReturnValue(couchDb);

    const args: SearchTodosArgs = { query: 'meeting', limit: 20, includeCompleted: true };

    const result = await executeSearchTodos(args, context, () => esClient, mockGetUserDb);
    const parsed = JSON.parse(result);

    expect(parsed.summary).toBe('Found 2 matching todos');
    expect(parsed.data.results).toHaveLength(2);

    // Verify full todo data from CouchDB (not ES preview)
    const result1 = parsed.data.results[0];
    expect(result1._score).toBe(5.2);
    expect(result1.title).toBe('Meeting notes');
    expect(result1.notes).toHaveLength(1); // Full notes from CouchDB
    expect(result1.metadata).toEqual({ source: 'manual' }); // Metadata preserved

    const result2 = parsed.data.results[1];
    expect(result2.blockedBy).toEqual(['todo-3']); // blockedBy from CouchDB

    // Verify ES query only requested IDs and scores
    expect(esClient.esql.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('KEEP todoId, _score'),
      }),
    );

    // Verify CouchDB bulk fetch was called
    expect(couchDb.fetch).toHaveBeenCalledWith({ keys: ['todo-1', 'todo-2'] });
  });

  it('parses tag filter from query', async () => {
    const context = createMockContext({
      userId: 'user_test',
      dbName: 'eddo_user_test',
      attachmentsDbName: 'eddo_attachments_test',
      username: 'test',
    });

    const esClient = createMockEsClient([]);
    const couchDb = createMockCouchDb([]);
    mockGetUserDb.mockReturnValue(couchDb);

    const args: SearchTodosArgs = {
      query: 'tag:gtd:next urgent task',
      limit: 20,
      includeCompleted: true,
    };

    const result = await executeSearchTodos(args, context, () => esClient, mockGetUserDb);
    const parsed = JSON.parse(result);

    expect(parsed.data.parsed.tags).toContain('gtd:next');
    expect(parsed.data.parsed.searchText).toBe('urgent task');

    // Verify ES query includes tag filter
    expect(esClient.esql.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('tags : "gtd:next"'),
      }),
    );
  });

  it('parses context filter from query', async () => {
    const context = createMockContext({
      userId: 'user_test',
      dbName: 'eddo_user_test',
      attachmentsDbName: 'eddo_attachments_test',
      username: 'test',
    });

    const esClient = createMockEsClient([]);
    const couchDb = createMockCouchDb([]);
    mockGetUserDb.mockReturnValue(couchDb);

    const args: SearchTodosArgs = {
      query: 'context:elastic bug fix',
      limit: 20,
      includeCompleted: true,
    };

    const result = await executeSearchTodos(args, context, () => esClient, mockGetUserDb);
    const parsed = JSON.parse(result);

    expect(parsed.data.parsed.context).toBe('elastic');
    expect(parsed.data.parsed.searchText).toBe('bug fix');

    // Verify ES query includes context filter
    expect(esClient.esql.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('context == "elastic"'),
      }),
    );
  });

  it('filters out completed when includeCompleted is false', async () => {
    const context = createMockContext({
      userId: 'user_test',
      dbName: 'eddo_user_test',
      attachmentsDbName: 'eddo_attachments_test',
      username: 'test',
    });

    const esClient = createMockEsClient([]);
    const couchDb = createMockCouchDb([]);
    mockGetUserDb.mockReturnValue(couchDb);

    const args: SearchTodosArgs = {
      query: 'meeting',
      limit: 20,
      includeCompleted: false,
    };

    await executeSearchTodos(args, context, () => esClient, mockGetUserDb);

    // Verify ES query includes completion filter
    expect(esClient.esql.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('completed IS NULL'),
      }),
    );
  });

  it('handles index not found gracefully', async () => {
    const context = createMockContext({
      userId: 'user_newuser',
      dbName: 'eddo_user_newuser',
      attachmentsDbName: 'eddo_attachments_newuser',
      username: 'newuser',
    });

    const esClient = {
      esql: {
        query: vi.fn().mockRejectedValue(new Error('index_not_found_exception')),
      },
    } as unknown as Client;

    const args: SearchTodosArgs = { query: 'meeting', limit: 20, includeCompleted: true };

    const result = await executeSearchTodos(args, context, () => esClient, mockGetUserDb);
    const parsed = JSON.parse(result);

    // Should return empty results, not an error
    expect(parsed.summary).toContain('No search index found');
    expect(parsed.data.results).toEqual([]);
  });

  it('limits results to max 100', async () => {
    const context = createMockContext({
      userId: 'user_test',
      dbName: 'eddo_user_test',
      attachmentsDbName: 'eddo_attachments_test',
      username: 'test',
    });

    const esClient = createMockEsClient([]);
    const couchDb = createMockCouchDb([]);
    mockGetUserDb.mockReturnValue(couchDb);

    const args: SearchTodosArgs = {
      query: 'meeting',
      limit: 500, // Request more than allowed
      includeCompleted: true,
    };

    await executeSearchTodos(args, context, () => esClient, mockGetUserDb);

    // Verify ES query limits to 100
    expect(esClient.esql.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('LIMIT 100'),
      }),
    );
  });

  it('handles missing docs gracefully (deleted between ES and CouchDB)', async () => {
    const context = createMockContext({
      userId: 'user_test',
      dbName: 'eddo_user_test',
      attachmentsDbName: 'eddo_attachments_test',
      username: 'test',
    });

    const todo1 = createMockTodo({ _id: 'todo-1', title: 'Exists' });
    // todo-2 doesn't exist in CouchDB (deleted after ES indexed it)

    const esClient = createMockEsClient([
      { todoId: 'todo-1', _score: 5.0 },
      { todoId: 'todo-2', _score: 3.0 }, // Will be missing from CouchDB
    ]);

    // CouchDB only returns todo-1
    const couchDb = {
      fetch: vi.fn().mockResolvedValue({
        rows: [
          { id: 'todo-1', doc: todo1 },
          { id: 'todo-2', error: 'not_found' }, // Missing doc
        ],
      }),
    } as unknown as nano.DocumentScope<TodoAlpha3>;
    mockGetUserDb.mockReturnValue(couchDb);

    const args: SearchTodosArgs = { query: 'test', limit: 20, includeCompleted: true };

    const result = await executeSearchTodos(args, context, () => esClient, mockGetUserDb);
    const parsed = JSON.parse(result);

    // Should only return the existing doc
    expect(parsed.data.results).toHaveLength(1);
    expect(parsed.data.results[0].title).toBe('Exists');
  });
});
