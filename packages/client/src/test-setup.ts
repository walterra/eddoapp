// Test setup for React components with real PouchDB using memory adapter
import { DatabaseHealthMonitor, createSafeDbOperations } from '@eddo/shared';
import memory from 'pouchdb-adapter-memory';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
import { vi } from 'vitest';

import type { PouchDbContextType } from './pouch_db_types';
import './test-polyfill';

// Add memory adapter and find plugin for testing
PouchDB.plugin(memory);
PouchDB.plugin(PouchDBFind);

let testDbCounter = 0;

// Create real PouchDB instance with memory adapter for testing
export const createTestPouchDb = () => {
  // Use unique names to avoid conflicts
  const dbName = `test-db-${Date.now()}-${++testDbCounter}`;
  const db = new PouchDB(dbName, { adapter: 'memory' });

  const safeDbOperations = createSafeDbOperations(db);
  const healthMonitor = new DatabaseHealthMonitor(db);

  const contextValue: PouchDbContextType = {
    safeDb: safeDbOperations,
    changes: db.changes.bind(db),
    sync: db.sync.bind(db),
    healthMonitor,
    rawDb: db,
  };

  return { db, contextValue };
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
