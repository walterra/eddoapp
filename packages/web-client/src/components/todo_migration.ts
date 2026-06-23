import {
  type Todo,
  type TodoAlpha1,
  type TodoAlpha2,
  type TodoAlpha3,
  isTodoAlpha2,
  isTodoAlpha3,
  migrateTodo,
} from '@eddo/core-client';

export const LEGACY_TODO_VERSIONS = ['alpha1', 'alpha2', 'alpha3'] as const;
export const MIGRATION_BATCH_SIZE = 100;

export interface MigrationSelector {
  version: { $in: string[] };
  due?: { $gte: string; $lte: string };
}

export type LegacyTodoDocument = TodoAlpha1 | TodoAlpha2 | TodoAlpha3;

export interface TodoMigrationDatabase {
  find(query: { selector: MigrationSelector; limit: number }): Promise<{ docs: unknown[] }>;
  bulkDocs(docs: Todo[]): Promise<unknown>;
}

interface MigrationBatchOptions {
  batchSize?: number;
}

interface MigrationBatchesOptions extends MigrationBatchOptions {
  yieldToBrowser?: () => Promise<void>;
}

/**
 * Yields to the browser event loop between migration batches.
 *
 * @return Promise resolved after yielding.
 */
export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

/**
 * Builds a selector for visible legacy todos.
 *
 * @param startDate Date range start.
 * @param endDate Date range end.
 * @return Mango selector for visible legacy todos.
 */
export function createVisibleLegacyTodoSelector(
  startDate: string,
  endDate: string,
): MigrationSelector {
  return {
    version: { $in: [...LEGACY_TODO_VERSIONS] },
    due: { $gte: startDate, $lte: `${endDate}T\uffff` },
  };
}

/**
 * Builds a selector for all legacy todos.
 *
 * @return Mango selector for all legacy todos.
 */
export function createAllLegacyTodoSelector(): MigrationSelector {
  return {
    version: { $in: [...LEGACY_TODO_VERSIONS] },
  };
}

/**
 * Checks if a database document is a pre-v4 todo.
 *
 * @param doc Database document.
 * @return True when doc is a legacy todo.
 */
export function isLegacyTodoDocument(doc: unknown): doc is LegacyTodoDocument {
  if (isTodoAlpha2(doc) || isTodoAlpha3(doc)) return true;
  if (!doc || typeof doc !== 'object') return false;

  const candidate = doc as Record<string, unknown>;
  return (
    typeof candidate._id === 'string' &&
    typeof candidate._rev === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.context === 'string' &&
    typeof candidate.completed === 'boolean' &&
    !('version' in candidate)
  );
}

/**
 * Migrates a legacy todo document to the latest schema.
 *
 * @param doc Legacy todo document.
 * @return Migrated todo.
 */
export function migrateDocumentToLatest(doc: LegacyTodoDocument): Todo {
  return { ...migrateTodo(doc), _rev: doc._rev };
}

/**
 * Fetches legacy todo documents with a targeted Mango selector.
 *
 * @param db PouchDB-compatible database.
 * @param selector Mango selector.
 * @param options Batch options.
 * @return Matching legacy documents.
 */
export async function findLegacyTodos(
  db: TodoMigrationDatabase,
  selector: MigrationSelector,
  options: MigrationBatchOptions = {},
): Promise<LegacyTodoDocument[]> {
  const result = await db.find({
    selector,
    limit: options.batchSize ?? MIGRATION_BATCH_SIZE,
  });

  return result.docs.filter(isLegacyTodoDocument);
}

/**
 * Migrates one batch of legacy todos matched by the selector.
 *
 * @param db PouchDB-compatible database.
 * @param selector Mango selector.
 * @param options Batch options.
 * @return Number of migrated docs.
 */
export async function migrateLegacyTodoBatch(
  db: TodoMigrationDatabase,
  selector: MigrationSelector,
  options: MigrationBatchOptions = {},
): Promise<number> {
  const docs = await findLegacyTodos(db, selector, options);
  const migratedDocs = docs.map((doc) => migrateDocumentToLatest(doc));

  if (migratedDocs.length === 0) return 0;

  await db.bulkDocs(migratedDocs);
  return migratedDocs.length;
}

/**
 * Migrates all matched legacy todos in batches.
 *
 * @param db PouchDB-compatible database.
 * @param selector Mango selector.
 * @param options Batch and yielding options.
 * @return Number of migrated docs.
 */
export async function migrateLegacyTodoBatches(
  db: TodoMigrationDatabase,
  selector: MigrationSelector,
  options: MigrationBatchesOptions = {},
): Promise<number> {
  let migratedCount = 0;
  let batchCount = 0;
  const yieldBetweenBatches = options.yieldToBrowser ?? yieldToBrowser;

  do {
    batchCount = await migrateLegacyTodoBatch(db, selector, options);
    migratedCount += batchCount;
    await yieldBetweenBatches();
  } while (batchCount > 0);

  return migratedCount;
}

/**
 * Migrates current-view todos before view queries run.
 *
 * @param db PouchDB-compatible database.
 * @param startDate Date range start.
 * @param endDate Date range end.
 * @return Number of migrated docs.
 */
export async function migrateVisibleLegacyTodos(
  db: TodoMigrationDatabase | undefined,
  startDate: string,
  endDate: string,
): Promise<number> {
  if (!db) return 0;
  return migrateLegacyTodoBatches(db, createVisibleLegacyTodoSelector(startDate, endDate));
}

/**
 * Migrates all local legacy todos in background batches.
 *
 * @param db PouchDB-compatible database.
 * @return Number of migrated docs.
 */
export async function migrateLocalTodosInBackground(
  db: TodoMigrationDatabase | undefined,
): Promise<number> {
  if (!db) return 0;
  return migrateLegacyTodoBatches(db, createAllLegacyTodoSelector());
}
