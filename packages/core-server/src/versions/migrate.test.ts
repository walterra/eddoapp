import {
  createTestTodoAlpha1,
  createTestTodoAlpha2,
  createTestTodoAlpha3,
} from '@eddo/core-shared/api/test-utils';
import { isLatestVersion, migrateTodo } from '@eddo/core-shared/versions/migrate';
import { type TodoAlpha1 } from '@eddo/core-shared/versions/todo_alpha1';
import { type TodoAlpha2 } from '@eddo/core-shared/versions/todo_alpha2';
import { type TodoAlpha3 } from '@eddo/core-shared/versions/todo_alpha3';
import memory from 'pouchdb-adapter-memory';
import PouchDB from 'pouchdb-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase } from '../api/database-factory';

// Add memory adapter for testing
PouchDB.plugin(memory);

describe('Database Migration Functions', () => {
  let db: PouchDB.Database;

  beforeEach(() => {
    db = createDatabase(PouchDB, {
      name: `migrate-test-${Date.now()}`,
      adapter: 'memory',
    });
  });

  afterEach(async () => {
    if (db) {
      await db.destroy();
    }
  });

  describe('migrateTodo', () => {
    it('should migrate from alpha1 to alpha3', () => {
      const alpha1Todo: TodoAlpha1 = {
        ...createTestTodoAlpha1({
          _id: '2025-01-01T00:00:00.000Z',
          title: 'Test Todo',
          completed: false,
          context: 'work',
        }),
        _rev: '1-abc',
      };

      const result = migrateTodo(alpha1Todo);

      expect(result.version).toBe('alpha3');
      expect(result.title).toBe('Test Todo');
      expect(result.description).toBe(''); // Alpha1 has no description
      expect(result.active).toEqual({});
      expect(result.externalId).toBe(null);
      expect(result.link).toBe(null);
      expect(result.due).toBe('2025-01-01T23:59:59.999Z'); // Generated from _id
      expect(result.context).toBe('work');
      expect(result.tags).toEqual([]); // Alpha1 has no tags
      expect(result.completed).toBe(null); // false -> null
    });

    it('should migrate from alpha2 to alpha3', () => {
      const alpha2Todo: TodoAlpha2 = {
        ...createTestTodoAlpha2({
          _id: '2025-01-01T00:00:00.000Z',
          title: 'Test Todo',
          description: 'Test description',
          tags: ['test'],
          active: { '2025-01-01': 'start' },
        }),
        _rev: '2-def',
      };

      const result = migrateTodo(alpha2Todo);

      expect(result.version).toBe('alpha3');
      expect(result.active).toEqual({ '2025-01-01': 'start' });
      expect(result.externalId).toBe(null);
      expect(result.link).toBe(null);
    });

    it('should return alpha3 todo unchanged', () => {
      const alpha3Todo = {
        ...createTestTodoAlpha3({
          _id: '2025-01-01T00:00:00.000Z',
          title: 'Test Todo',
          description: 'Test description',
          due: '2025-01-02',
          context: 'work',
          tags: ['test'],
          active: { '2025-01-01': 'start' },
          link: 'https://example.com',
        }),
        _rev: '1-abc',
      } as TodoAlpha3;

      const result = migrateTodo(alpha3Todo);

      expect(result).toEqual(alpha3Todo);
    });

    it('should throw error for invalid todo', () => {
      const invalidTodo = { invalid: 'data' };

      expect(() => migrateTodo(invalidTodo)).toThrow();
    });
  });

  describe('isLatestVersion', () => {
    it('should return true for alpha3 todo', () => {
      const alpha3Todo = createTestTodoAlpha3({
        _id: '2025-01-01T00:00:00.000Z',
        title: 'Test Todo',
        description: 'Test description',
        due: '2025-01-02',
        context: 'work',
        tags: ['test'],
      });

      expect(isLatestVersion(alpha3Todo)).toBe(true);
    });

    it('should return false for alpha2 todo', () => {
      const alpha2Todo = createTestTodoAlpha2({
        _id: '2025-01-01T00:00:00.000Z',
        title: 'Test Todo',
        description: 'Test description',
        due: '2025-01-02',
        context: 'work',
        tags: ['test'],
      });

      expect(isLatestVersion(alpha2Todo)).toBe(false);
    });

    it('should return false for invalid data', () => {
      expect(isLatestVersion(null)).toBe(false);
      expect(isLatestVersion(undefined)).toBe(false);
      expect(isLatestVersion({})).toBe(false);
      expect(isLatestVersion('string')).toBe(false);
    });
  });

  describe('Database Migration Integration', () => {
    it('should migrate document in database from alpha2 to alpha3', async () => {
      const alpha2Doc = createTestTodoAlpha2({
        _id: '2025-01-01T00:00:00.000Z',
        title: 'Migration Test',
        description: 'Test migration in database',
        due: '2025-01-02',
        context: 'test',
        tags: ['migration'],
        active: { '2025-01-01': 'start' },
      });

      await db.put(alpha2Doc);

      // Simulate migration process
      const doc = await db.get(alpha2Doc._id);
      const migratedDoc = migrateTodo(doc);
      await db.put({ ...migratedDoc, _rev: doc._rev });

      const updatedDoc = await db.get<TodoAlpha3>(alpha2Doc._id);
      expect(updatedDoc.version).toBe('alpha3');
      expect(updatedDoc.externalId).toBe(null);
      expect(updatedDoc.link).toBe(null);
      expect(updatedDoc.active).toEqual({
        '2025-01-01': 'start',
      });
    });

    it('should handle bulk migration of multiple documents', async () => {
      const docs = [
        {
          _id: '2025-01-01T00:00:00.000Z',
          title: 'Todo 1',
          description: 'First todo',
          completed: null,
          due: '2025-01-02',
          context: 'work',
          repeat: null,
          tags: [],
          active: {},
          version: 'alpha2',
        },
        {
          _id: '2025-01-02T00:00:00.000Z',
          title: 'Todo 2',
          description: 'Second todo',
          completed: null,
          due: '2025-01-03',
          context: 'personal',
          repeat: null,
          tags: ['urgent'],
          active: { '2025-01-02': 'start' },
          version: 'alpha2',
        },
      ];

      await db.bulkDocs(docs);

      // Get all docs and migrate them
      const allDocs = await db.allDocs({ include_docs: true });
      const migratedDocs = allDocs.rows
        .map((row) => {
          if (row.doc) {
            const migrated = migrateTodo(row.doc);
            return { ...migrated, _rev: row.doc._rev };
          }
          return null;
        })
        .filter((doc): doc is TodoAlpha3 & { _rev: string } => doc !== null);

      await db.bulkDocs(migratedDocs);

      // Verify all docs are migrated
      const updatedDocs = await db.allDocs({ include_docs: true });
      updatedDocs.rows.forEach((row) => {
        if (row.doc) {
          const doc = row.doc as PouchDB.Core.ExistingDocument<{
            version: string;
          }>;
          expect(doc.version).toBe('alpha3');
          expect(isLatestVersion(doc)).toBe(true);
        }
      });
    });
  });
});
