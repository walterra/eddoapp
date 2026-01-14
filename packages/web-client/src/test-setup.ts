// Test setup for React components with real PouchDB using memory adapter
import { DatabaseHealthMonitor } from '@eddo/core-client';
import memory from 'pouchdb-adapter-memory';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
import { vi } from 'vitest';

import { createSafeDbOperations } from './api/safe-db-operations';
import type { PouchDbContextType } from './pouch_db_types';
import './test-polyfill';

// Add memory adapter and find plugin for testing
PouchDB.plugin(memory);
PouchDB.plugin(PouchDBFind);

let testDbCounter = 0;

/** Creates required indexes and design documents for tests */
export async function createTestIndexes(db: PouchDB.Database): Promise<void> {
  // Mango indexes
  await db.createIndex({ index: { fields: ['version'] } });
  await db.createIndex({ index: { fields: ['version', 'due'] } });

  // MapReduce design documents for tags and contexts
  await db.put({
    _id: '_design/tags',
    views: {
      by_tag: {
        map: `function(doc) {
          if (doc.version === 'alpha3' && doc.tags && Array.isArray(doc.tags) && doc.tags.length > 0) {
            for (var i = 0; i < doc.tags.length; i++) {
              var tag = (doc.tags[i] || '').trim();
              if (tag) emit(tag, 1);
            }
          }
        }`,
        reduce: '_count',
      },
    },
  });

  await db.put({
    _id: '_design/contexts',
    views: {
      by_context: {
        map: `function(doc) {
          if (doc.version === 'alpha3' && doc.context) {
            var ctx = doc.context.trim();
            if (ctx) emit(ctx, 1);
          }
        }`,
        reduce: '_count',
      },
    },
  });
}

// Create real PouchDB instance with memory adapter for testing
export const createTestPouchDb = () => {
  // Use unique names to avoid conflicts
  const dbName = `test-db-${Date.now()}-${++testDbCounter}`;
  const db = new PouchDB(dbName, { adapter: 'memory' });

  // Create attachments db for testing
  const attachmentsDbName = `test-attachments-${Date.now()}-${testDbCounter}`;
  const attachmentsDb = new PouchDB(attachmentsDbName, { adapter: 'memory' });

  const safeDbOperations = createSafeDbOperations(db);
  const healthMonitor = new DatabaseHealthMonitor(db);

  const contextValue: PouchDbContextType = {
    safeDb: safeDbOperations,
    changes: db.changes.bind(db),
    sync: db.sync.bind(db),
    healthMonitor,
    rawDb: db,
    attachmentsDb,
  };

  return { db, attachmentsDb, contextValue };
};

// Helper to destroy test database
export const destroyTestPouchDb = async (db: PouchDB.Database) => {
  try {
    await db.destroy();
  } catch (error) {
    // Ignore errors during cleanup
    console.warn('Error destroying test database:', error);
  }
};

// Setup fake timers for time tracking tests
export const setupTimers = () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-07-12T10:00:00.000Z'));
};

export const cleanupTimers = () => {
  vi.clearAllTimers();
  vi.useRealTimers();
};
