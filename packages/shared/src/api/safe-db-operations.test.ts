import memory from 'pouchdb-adapter-memory';
import PouchDB from 'pouchdb-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseOperationError } from '../types/database-errors';
import { createDatabase } from './database-factory';
import {
  type SafeDbOperations,
  createSafeDbOperations,
} from './safe-db-operations';
import './test-setup';
import { createTestTodoAlpha3 } from './test-utils';
import { type TodoAlpha3 } from './versions/todo_alpha3';

// Add memory adapter for testing
PouchDB.plugin(memory);

describe('SafeDbOperations Integration Tests', () => {
  let db: PouchDB.Database;
  let safeDb: SafeDbOperations;

  beforeEach(() => {
    db = createDatabase(PouchDB, {
      name: `safe-db-test-${Date.now()}`,
      adapter: 'memory',
    });
    safeDb = createSafeDbOperations(db);
  });

  afterEach(async () => {
    if (db) {
      await db.destroy();
    }
  });

  describe('safeGet', () => {
    it('should return document when found', async () => {
      const todo = createTestTodoAlpha3({
        _id: 'test-get-id',
        title: 'Test Todo',
        description: 'Test description',
        context: 'work',
      });

      await db.put(todo);
      const result = await safeDb.safeGet<TodoAlpha3>('test-get-id');

      expect(result).toBeTruthy();
      expect(result?.title).toBe('Test Todo');
      expect(result?.version).toBe('alpha3');
    });

    it('should return null when document not found', async () => {
      const result = await safeDb.safeGet('nonexistent-id');

      expect(result).toBe(null);
    });

    it('should handle concurrent gets', async () => {
      const todo = createTestTodoAlpha3({
        _id: 'concurrent-get-id',
        title: 'Concurrent Test',
        description: 'Testing concurrent gets',
        context: 'test',
      });

      await db.put(todo);

      // Perform multiple concurrent gets
      const results = await Promise.all([
        safeDb.safeGet<TodoAlpha3>('concurrent-get-id'),
        safeDb.safeGet<TodoAlpha3>('concurrent-get-id'),
        safeDb.safeGet<TodoAlpha3>('concurrent-get-id'),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result?.title).toBe('Concurrent Test');
      });
    });
  });

  describe('safePut', () => {
    it('should successfully create new document', async () => {
      const todo = createTestTodoAlpha3({
        _id: 'test-put-id',
        title: 'New Todo',
        description: 'New description',
        context: 'work',
        tags: ['urgent'],
      });

      const result = await safeDb.safePut(todo);

      expect(result._id).toBe('test-put-id');
      expect(result._rev).toBeDefined();
      expect(result.title).toBe('New Todo');

      // Verify it was saved
      const saved = await db.get<TodoAlpha3>(todo._id);
      expect(saved.title).toBe('New Todo');
    });

    it('should successfully update existing document', async () => {
      const todo = createTestTodoAlpha3({
        _id: 'test-update-id',
        title: 'Original Title',
        description: 'Original description',
        context: 'work',
      });

      const createResult = await safeDb.safePut(todo);

      const updatedTodo = {
        ...createResult,
        title: 'Updated Title',
        completed: '2025-01-01T12:00:00.000Z',
      };

      const updateResult = await safeDb.safePut(updatedTodo);

      expect(updateResult.title).toBe('Updated Title');
      expect(updateResult.completed).toBe('2025-01-01T12:00:00.000Z');
      expect(updateResult._rev).not.toBe(createResult._rev);
    });

    it('should handle conflict errors', async () => {
      const todo = createTestTodoAlpha3({
        _id: 'conflict-id',
        title: 'Conflict Test',
        description: 'Testing conflicts',
        context: 'test',
      });

      const result1 = await safeDb.safePut(todo);

      // Create a conflicting update with old revision
      const conflictUpdate = {
        ...todo,
        _rev: result1._rev,
        title: 'Conflict Update',
      };

      // Make another update to create conflict
      await safeDb.safePut({ ...result1, title: 'First Update' });

      // This should throw a conflict error
      await expect(safeDb.safePut(conflictUpdate)).rejects.toThrow(
        DatabaseOperationError,
      );
    });
  });

  describe('safeRemove', () => {
    it('should successfully remove document', async () => {
      const todo = createTestTodoAlpha3({
        _id: 'remove-id',
        title: 'To Be Removed',
        description: 'Will be deleted',
        context: 'test',
      });

      const putResult = await safeDb.safePut(todo);
      await safeDb.safeRemove({ _id: putResult._id, _rev: putResult._rev });

      // Verify document is gone
      const getResult = await safeDb.safeGet('remove-id');
      expect(getResult).toBe(null);
    });

    it('should throw error when removing non-existent document', async () => {
      const fakeDoc = {
        _id: 'nonexistent-remove-id',
        _rev: '1-fake',
      };

      // Should throw a DatabaseError for missing document
      await expect(safeDb.safeRemove(fakeDoc)).rejects.toThrow(
        DatabaseOperationError,
      );
    });
  });

  describe('safeAllDocs', () => {
    it('should return all documents', async () => {
      const todos = [
        createTestTodoAlpha3({
          _id: 'all-docs-1',
          title: 'First Todo',
          description: 'First',
          context: 'work',
        }),
        createTestTodoAlpha3({
          _id: 'all-docs-2',
          title: 'Second Todo',
          description: 'Second',
          due: '2025-01-03',
          context: 'personal',
          tags: ['important'],
        }),
      ];

      await Promise.all(todos.map((t) => safeDb.safePut(t)));

      const result = await safeDb.safeAllDocs<TodoAlpha3>({
        include_docs: true,
      });

      expect(result.length).toBeGreaterThanOrEqual(2);
      const titles = result.map((doc) => doc.title);
      expect(titles).toContain('First Todo');
      expect(titles).toContain('Second Todo');
    });

    it('should handle empty database', async () => {
      const result = await safeDb.safeAllDocs();

      expect(result).toEqual([]);
    });

    it('should respect query options', async () => {
      const todos = Array.from({ length: 5 }, (_, i) =>
        createTestTodoAlpha3({
          _id: `limited-${i}`,
          title: `Todo ${i}`,
          description: `Description ${i}`,
          context: 'test',
        }),
      );

      await Promise.all(todos.map((t) => safeDb.safePut(t)));

      const result = await safeDb.safeAllDocs<TodoAlpha3>({
        include_docs: true,
        limit: 3,
      });

      expect(result).toHaveLength(3);
    });
  });

  describe('safeBulkDocs', () => {
    it('should successfully insert multiple documents', async () => {
      const todos = [
        createTestTodoAlpha3({
          _id: 'bulk-1',
          title: 'Bulk Todo 1',
          description: 'First bulk',
          context: 'work',
        }),
        createTestTodoAlpha3({
          _id: 'bulk-2',
          title: 'Bulk Todo 2',
          description: 'Second bulk',
          due: '2025-01-03',
          context: 'personal',
        }),
      ];

      const result = await safeDb.safeBulkDocs(todos);

      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe('bulk-1');
      expect(result[0]._rev).toBeDefined();
      expect(result[1]._id).toBe('bulk-2');
      expect(result[1]._rev).toBeDefined();

      // Verify they were saved
      const saved1 = await safeDb.safeGet<TodoAlpha3>('bulk-1');
      const saved2 = await safeDb.safeGet<TodoAlpha3>('bulk-2');
      expect(saved1?.title).toBe('Bulk Todo 1');
      expect(saved2?.title).toBe('Bulk Todo 2');
    });

    it('should handle empty bulk operation', async () => {
      const result = await safeDb.safeBulkDocs([]);

      expect(result).toEqual([]);
    });

    it('should handle partial failures', async () => {
      const existingTodo = createTestTodoAlpha3({
        _id: 'existing-bulk',
        title: 'Existing',
        description: 'Already exists',
        context: 'test',
      });

      await safeDb.safePut(existingTodo);

      const todos = [
        createTestTodoAlpha3({
          _id: 'new-bulk',
          title: 'New Todo',
          description: 'New',
          context: 'test',
        }),
        {
          ...existingTodo,
          _rev: 'wrong-rev', // This will cause a conflict
          title: 'Conflict Update',
        },
      ];

      await expect(safeDb.safeBulkDocs(todos)).rejects.toThrow(
        DatabaseOperationError,
      );
    });
  });

  describe('safeQuery', () => {
    beforeEach(async () => {
      // Set up a design document for testing queries
      await db.put({
        _id: '_design/test',
        views: {
          by_context: {
            map: `function(doc) {
              if (doc.context) {
                emit(doc.context, doc);
              }
            }`,
          },
          by_completed: {
            map: `function(doc) {
              if (doc.completed !== undefined) {
                emit(doc.completed !== null, doc);
              }
            }`,
          },
        },
      });

      // Add test data
      const todos = [
        createTestTodoAlpha3({
          _id: 'query-1',
          title: 'Work Todo 1',
          description: 'Work',
          context: 'work',
        }),
        createTestTodoAlpha3({
          _id: 'query-2',
          title: 'Work Todo 2',
          description: 'Work',
          completed: '2025-01-01T12:00:00.000Z',
          context: 'work',
        }),
        createTestTodoAlpha3({
          _id: 'query-3',
          title: 'Personal Todo',
          description: 'Personal',
          context: 'personal',
        }),
      ];

      await Promise.all(todos.map((t) => safeDb.safePut(t)));
    });

    it('should query by context', async () => {
      const result = await safeDb.safeQuery<TodoAlpha3>('test', 'by_context', {
        key: 'work',
        include_docs: true,
      });

      expect(result).toHaveLength(2);
      expect(result.every((doc) => doc.context === 'work')).toBe(true);
    });

    it('should query completed todos', async () => {
      const result = await safeDb.safeQuery<TodoAlpha3>(
        'test',
        'by_completed',
        {
          key: true,
          include_docs: true,
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].completed).not.toBe(null);
    });

    it('should handle empty query results', async () => {
      const result = await safeDb.safeQuery<TodoAlpha3>('test', 'by_context', {
        key: 'nonexistent',
        include_docs: true,
      });

      expect(result).toEqual([]);
    });
  });

  describe('Error Recovery', () => {
    it('should retry operations on transient failures', async () => {
      const todo = createTestTodoAlpha3({
        _id: 'retry-test',
        title: 'Retry Test',
        description: 'Testing retry',
        context: 'test',
      });

      // First save the document
      const originalDb = db;
      await originalDb.put(todo);

      // Mock a transient failure by temporarily breaking the get method
      const originalGet = originalDb.get.bind(originalDb);
      let callCount = 0;

      const mockedDb = {
        ...originalDb,
        get: vi.fn().mockImplementation(async (id: string) => {
          callCount++;
          if (callCount === 1) {
            // Simulate a retryable error
            const error = new Error('Temporary failure') as Error & {
              status: number;
            };
            error.status = 500;
            throw error;
          }
          return originalGet(id);
        }),
      };

      // Create a new safeDb instance with the mocked db
      const mockedSafeDb = createSafeDbOperations(mockedDb as PouchDB.Database);

      const result = await mockedSafeDb.safeGet<TodoAlpha3>('retry-test');

      expect(result?.title).toBe('Retry Test');
      expect(callCount).toBe(2); // First call failed, second succeeded
    });
  });
});
