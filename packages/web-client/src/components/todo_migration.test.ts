import { describe, expect, it, vi } from 'vitest';

import { type Todo, type TodoAlpha1, type TodoAlpha3 } from '@eddo/core-client';

import {
  createAllLegacyTodoSelector,
  createVisibleLegacyTodoSelector,
  findLegacyTodos,
  isLegacyTodoDocument,
  migrateDocumentToLatest,
  migrateLegacyTodoBatch,
  migrateLegacyTodoBatches,
  migrateLocalTodosInBackground,
  migrateVisibleLegacyTodos,
  type LegacyTodoDocument,
  type MigrationSelector,
  type TodoMigrationDatabase,
} from './todo_migration';

function createAlpha1Todo(overrides: Partial<TodoAlpha1> = {}): LegacyTodoDocument {
  return {
    _id: '2026-01-02T09:00:00.000Z',
    _rev: '1-alpha1',
    completed: false,
    context: 'work',
    title: 'Legacy task',
    ...overrides,
  };
}

function createAlpha3Todo(overrides: Partial<TodoAlpha3> = {}): LegacyTodoDocument {
  return {
    _id: '2026-01-02T09:00:00.000Z',
    _rev: '1-alpha3',
    active: {},
    completed: null,
    context: 'work',
    description: '',
    due: '2026-01-02T23:59:59.999Z',
    externalId: null,
    link: null,
    repeat: null,
    tags: [],
    title: '9:05 Kaiserwinkl Oldtimertage',
    version: 'alpha3',
    ...overrides,
  };
}

function matchesSelector(doc: unknown, selector: MigrationSelector): boolean {
  if (!isLegacyTodoDocument(doc)) return false;
  if (!('version' in doc) || !selector.version.$in.includes(doc.version)) return false;
  if (!selector.due) return true;
  return doc.due >= selector.due.$gte && doc.due <= selector.due.$lte;
}

function createMigrationDb(docs: unknown[]): TodoMigrationDatabase {
  const storedDocs = [...docs];

  return {
    find: vi.fn(async ({ selector, limit }) => ({
      docs: storedDocs.filter((doc) => matchesSelector(doc, selector)).slice(0, limit),
    })),
    bulkDocs: vi.fn(async (updatedDocs: Todo[]) => {
      updatedDocs.forEach((updatedDoc) => {
        const index = storedDocs.findIndex(
          (doc) => isLegacyTodoDocument(doc) && doc._id === updatedDoc._id,
        );
        if (index >= 0) storedDocs[index] = updatedDoc;
      });
      return [];
    }),
  };
}

describe('todo migration', () => {
  describe('selectors', () => {
    it('creates a visible legacy todo selector', () => {
      expect(createVisibleLegacyTodoSelector('2026-01-01', '2026-01-07')).toEqual({
        version: { $in: ['alpha1', 'alpha2', 'alpha3'] },
        due: { $gte: '2026-01-01', $lte: '2026-01-07T\uffff' },
      });
    });

    it('creates an all legacy todo selector', () => {
      expect(createAllLegacyTodoSelector()).toEqual({
        version: { $in: ['alpha1', 'alpha2', 'alpha3'] },
      });
    });
  });

  describe('migrateDocumentToLatest', () => {
    it('migrates alpha3 todos to alpha4 with date-only due and scheduled time', () => {
      const result = migrateDocumentToLatest(createAlpha3Todo());

      expect(result).toMatchObject({
        _id: '2026-01-02T09:00:00.000Z',
        _rev: '1-alpha3',
        due: '2026-01-02',
        scheduledTime: '09:05',
        scheduledTimeZone: null,
        title: 'Kaiserwinkl Oldtimertage',
        version: 'alpha4',
      });
    });

    it('migrates alpha1 todos to alpha4', () => {
      const result = migrateDocumentToLatest(createAlpha1Todo());

      expect(result).toMatchObject({
        _id: '2026-01-02T09:00:00.000Z',
        _rev: '1-alpha1',
        due: '2026-01-02',
        scheduledTime: null,
        title: 'Legacy task',
        version: 'alpha4',
      });
    });

    it('identifies legacy todo documents', () => {
      expect(isLegacyTodoDocument(createAlpha1Todo())).toBe(true);
      expect(isLegacyTodoDocument(createAlpha3Todo())).toBe(true);
      expect(isLegacyTodoDocument({ _id: 'user-settings', _rev: '1-doc' })).toBe(false);
    });
  });

  describe('batch migration', () => {
    it('queries legacy todos with the configured batch size', async () => {
      const db = createMigrationDb([createAlpha3Todo()]);
      const selector = createAllLegacyTodoSelector();

      await findLegacyTodos(db, selector, { batchSize: 10 });

      expect(db.find).toHaveBeenCalledWith({ selector, limit: 10 });
    });

    it('migrates one batch and writes changed docs', async () => {
      const db = createMigrationDb([createAlpha3Todo()]);
      const count = await migrateLegacyTodoBatch(db, createAllLegacyTodoSelector());

      expect(count).toBe(1);
      expect(db.bulkDocs).toHaveBeenCalledWith([
        expect.objectContaining({
          due: '2026-01-02',
          scheduledTime: '09:05',
          version: 'alpha4',
        }),
      ]);
    });

    it('migrates multiple batches until no legacy docs remain', async () => {
      const yieldToBrowser = vi.fn(async () => undefined);
      const db = createMigrationDb([
        createAlpha3Todo({ _id: 'todo-1' }),
        createAlpha3Todo({ _id: 'todo-2' }),
      ]);

      const count = await migrateLegacyTodoBatches(db, createAllLegacyTodoSelector(), {
        batchSize: 1,
        yieldToBrowser,
      });

      expect(count).toBe(2);
      expect(db.find).toHaveBeenCalledTimes(3);
      expect(db.bulkDocs).toHaveBeenCalledTimes(2);
      expect(yieldToBrowser).toHaveBeenCalledTimes(3);
    });
  });

  describe('migration entry points', () => {
    it('migrates only visible legacy todos for the current range', async () => {
      const db = createMigrationDb([
        createAlpha3Todo({ _id: 'visible', due: '2026-01-02T23:59:59.999Z' }),
        createAlpha3Todo({ _id: 'outside', due: '2026-02-02T23:59:59.999Z' }),
      ]);

      const count = await migrateVisibleLegacyTodos(db, '2026-01-01', '2026-01-07');

      expect(count).toBe(1);
      expect(db.bulkDocs).toHaveBeenCalledWith([expect.objectContaining({ _id: 'visible' })]);
    });

    it('returns zero when visible migration has no database', async () => {
      await expect(migrateVisibleLegacyTodos(undefined, '2026-01-01', '2026-01-07')).resolves.toBe(
        0,
      );
    });

    it('migrates all local legacy todos in background mode', async () => {
      const db = createMigrationDb([
        createAlpha3Todo({ _id: 'todo-1' }),
        createAlpha3Todo({ _id: 'todo-2' }),
      ]);

      const count = await migrateLocalTodosInBackground(db);

      expect(count).toBe(2);
    });

    it('returns zero when background migration has no database', async () => {
      await expect(migrateLocalTodosInBackground(undefined)).resolves.toBe(0);
    });
  });
});
