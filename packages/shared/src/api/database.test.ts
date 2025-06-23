import memory from 'pouchdb-adapter-memory';
import PouchDB from 'pouchdb-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase } from './database-factory';
import './test-setup';
import { createTestTodoAlpha3 } from './test-utils';
import { type TodoAlpha3 } from './versions/todo_alpha3';

// Add memory adapter for testing
PouchDB.plugin(memory);

describe('Database Operations', () => {
  let db: PouchDB.Database;

  beforeEach(() => {
    db = createDatabase(PouchDB, {
      name: `database-test-${Date.now()}`,
      adapter: 'memory',
    });
  });

  afterEach(async () => {
    if (db) {
      await db.destroy();
    }
  });

  describe('Basic CRUD Operations', () => {
    it('should create a todo document', async () => {
      const todo = createTestTodoAlpha3({
        _id: '2025-01-01T00:00:00.000Z',
        title: 'Test Todo',
        description: 'Test description',
        context: 'work',
        tags: ['test'],
      });

      const result = await db.put(todo);
      expect(result.ok).toBe(true);
      expect(result.id).toBe(todo._id);

      const retrieved = await db.get<TodoAlpha3>(todo._id);
      expect(retrieved.title).toBe('Test Todo');
      expect(retrieved.version).toBe('alpha3');
    });

    it('should update a todo document', async () => {
      const todo = createTestTodoAlpha3({
        _id: '2025-01-01T00:00:00.000Z',
        title: 'Original Title',
        description: 'Original description',
        context: 'work',
      });

      const createResult = await db.put(todo);
      const updatedTodo = {
        ...todo,
        _rev: createResult.rev,
        title: 'Updated Title',
        completed: '2025-01-01T12:00:00.000Z',
      };

      const updateResult = await db.put(updatedTodo);
      expect(updateResult.ok).toBe(true);

      const retrieved = await db.get<TodoAlpha3>(todo._id);
      expect(retrieved.title).toBe('Updated Title');
      expect(retrieved.completed).toBe('2025-01-01T12:00:00.000Z');
    });

    it('should delete a todo document', async () => {
      const todo = createTestTodoAlpha3({
        _id: '2025-01-01T00:00:00.000Z',
        title: 'To Be Deleted',
        description: 'This will be deleted',
        context: 'work',
      });

      const createResult = await db.put(todo);
      await db.remove(todo._id, createResult.rev);

      await expect(db.get(todo._id)).rejects.toMatchObject({
        status: 404,
        name: 'not_found',
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk document creation', async () => {
      const todos = Array.from({ length: 10 }, (_, i) =>
        createTestTodoAlpha3({
          _id: `2025-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
          title: `Todo ${i + 1}`,
          description: `Description ${i + 1}`,
          completed: i % 2 === 0 ? '2025-01-01T12:00:00.000Z' : null,
          due: '2025-01-10',
          context: i % 2 === 0 ? 'work' : 'personal',
          tags: [`tag${i}`],
        }),
      );

      const result = await db.bulkDocs(todos);
      expect(result).toHaveLength(10);
      expect(result.every((r) => (r as any).ok)).toBe(true);

      const allDocs = await db.allDocs();
      expect(allDocs.rows).toHaveLength(10);
    });

    it('should query documents with allDocs', async () => {
      const todos = [
        createTestTodoAlpha3({
          _id: '2025-01-01T00:00:00.000Z',
          title: 'First Todo',
          description: 'First',
          context: 'work',
        }),
        createTestTodoAlpha3({
          _id: '2025-01-02T00:00:00.000Z',
          title: 'Second Todo',
          description: 'Second',
          completed: '2025-01-01T12:00:00.000Z',
          due: '2025-01-03',
          context: 'personal',
          tags: ['urgent'],
          link: 'https://example.com',
        }),
      ];

      await db.bulkDocs(todos);

      const result = await db.allDocs({ include_docs: true });
      expect(result.rows).toHaveLength(2);
      const docs = result.rows
        .map((row) => row.doc)
        .filter((doc): doc is TodoAlpha3 => doc !== undefined);
      expect(docs[0]?.title).toBe('First Todo');
      expect(docs[1]?.title).toBe('Second Todo');
    });
  });

  describe('Error Handling', () => {
    it('should handle document conflicts', async () => {
      const todo = createTestTodoAlpha3({
        _id: 'conflict-test',
        title: 'Original',
        description: 'Original description',
        context: 'work',
      });

      const result1 = await db.put(todo);

      // Create conflicting updates
      const conflictDoc = {
        ...todo,
        title: 'Conflict Version',
        _rev: result1.rev,
      };
      const updatedDoc = {
        ...todo,
        title: 'Updated Version',
        _rev: result1.rev,
      };

      await db.put(conflictDoc);

      // This should fail with conflict
      await expect(db.put(updatedDoc)).rejects.toMatchObject({
        status: 409,
        name: 'conflict',
      });
    });

    it('should handle missing document errors', async () => {
      await expect(db.get('nonexistent-id')).rejects.toMatchObject({
        status: 404,
        name: 'not_found',
      });
    });

    it('should handle invalid document structure', async () => {
      const invalidDoc = {
        _id: 'invalid-doc',
        // Missing required fields for TodoAlpha3
      };

      // Database will accept any structure, but application logic should validate
      const result = await db.put(invalidDoc);
      expect(result.ok).toBe(true);

      const retrieved = await db.get('invalid-doc');
      expect(retrieved._id).toBe('invalid-doc');
    });
  });

  describe('Changes Feed', () => {
    it('should react to database changes', async () => {
      const changes: any[] = [];

      const changeHandler = db
        .changes({
          since: 'now',
          live: true,
          include_docs: true,
        })
        .on('change', (change) => {
          changes.push(change);
        });

      const todo = createTestTodoAlpha3({
        _id: '2025-01-01T00:00:00.000Z',
        title: 'Change Test',
        description: 'Testing changes feed',
        context: 'test',
      });

      await db.put(todo);

      // Wait for change to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changes).toHaveLength(1);
      expect(changes[0].doc.title).toBe('Change Test');

      changeHandler.cancel();
    });

    it('should handle multiple changes', async () => {
      const changes: any[] = [];

      const changeHandler = db
        .changes({
          since: 'now',
          live: true,
          include_docs: true,
        })
        .on('change', (change) => {
          changes.push(change);
        });

      const todos = [
        createTestTodoAlpha3({
          _id: '2025-01-01T00:00:00.000Z',
          title: 'First Change',
          description: 'First',
          context: 'test',
        }),
        createTestTodoAlpha3({
          _id: '2025-01-02T00:00:00.000Z',
          title: 'Second Change',
          description: 'Second',
          due: '2025-01-03',
          context: 'test',
        }),
      ];

      await db.bulkDocs(todos);

      // Wait for changes to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(changes).toHaveLength(2);

      changeHandler.cancel();
    });
  });

  describe('Database Isolation', () => {
    it('should maintain isolation between test runs', async () => {
      const todo = createTestTodoAlpha3({
        _id: 'isolation-test',
        title: 'Isolation Test',
        description: 'Testing isolation',
        context: 'test',
      });

      await db.put(todo);

      const result = await db.allDocs();
      expect(result.rows).toHaveLength(1);

      // This test should start with a fresh database in the next run
    });

    it('should handle concurrent database instances', async () => {
      const db2 = createDatabase(PouchDB, {
        name: `concurrent-test-${Date.now()}`,
        adapter: 'memory',
      });

      try {
        const todo1 = createTestTodoAlpha3({
          _id: 'db1-todo',
          title: 'DB1 Todo',
          description: 'In first database',
          context: 'test',
        });

        const todo2 = createTestTodoAlpha3({
          _id: 'db2-todo',
          title: 'DB2 Todo',
          description: 'In second database',
          context: 'test',
        });

        await db.put(todo1);
        await db2.put(todo2);

        const db1Docs = await db.allDocs();
        const db2Docs = await db2.allDocs();

        expect(db1Docs.rows).toHaveLength(1);
        expect(db2Docs.rows).toHaveLength(1);
        expect(db1Docs.rows[0].id).toBe('db1-todo');
        expect(db2Docs.rows[0].id).toBe('db2-todo');
      } finally {
        await db2.destroy();
      }
    });
  });
});
