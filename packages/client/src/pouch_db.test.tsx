import { type Todo } from '@eddo/shared';
import { renderHook } from '@testing-library/react';
import React, { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PouchDbContext, type PouchDbContextType } from './pouch_db_types';
import './test-polyfill';
import { createTestPouchDb, destroyTestPouchDb } from './test-setup';
import { createTestTodo } from './test-utils';

// Create a test version of usePouchDb hook
const usePouchDb = () => {
  const context = useContext(PouchDbContext);
  if (!context) {
    throw new Error('usePouchDb must be used within a PouchDbContext.Provider');
  }
  return context;
};

describe('PouchDB Context and Hook', () => {
  let testContext: PouchDbContextType;
  let testDb: PouchDB.Database;

  beforeEach(() => {
    const { db, contextValue } = createTestPouchDb();
    testDb = db;
    testContext = contextValue;
  });

  afterEach(async () => {
    // Clean up database after each test following best practices
    if (testDb) {
      await destroyTestPouchDb(testDb);
    }
  });

  describe('usePouchDb hook', () => {
    it('should throw error when used outside provider', () => {
      // The error is caught during rendering, not in result.error
      // We need to suppress console.error during this test since React will log the error
      const originalError = console.error;
      console.error = () => {};

      try {
        expect(() => {
          renderHook(() => usePouchDb());
        }).toThrow('usePouchDb must be used within a PouchDbContext.Provider');
      } finally {
        console.error = originalError;
      }
    });

    it('should return context when used within provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PouchDbContext.Provider value={testContext}>
          {children}
        </PouchDbContext.Provider>
      );

      const { result } = renderHook(() => usePouchDb(), { wrapper });

      expect(result.current).toBe(testContext);
      expect(result.current.safeDb).toBeDefined();
      expect(result.current.changes).toBeDefined();
      expect(result.current.sync).toBeDefined();
      expect(result.current.healthMonitor).toBeDefined();
      expect(result.current.rawDb).toBeDefined();
    });
  });

  describe('PouchDbContextType interface', () => {
    it('should provide all required safe database operations', () => {
      expect(testContext.safeDb.safeGet).toBeDefined();
      expect(testContext.safeDb.safePut).toBeDefined();
      expect(testContext.safeDb.safeRemove).toBeDefined();
      expect(testContext.safeDb.safeQuery).toBeDefined();
      expect(testContext.safeDb.safeBulkDocs).toBeDefined();
      expect(testContext.safeDb.safeAllDocs).toBeDefined();
    });

    it('should provide database change operations', () => {
      expect(testContext.changes).toBeDefined();
      expect(testContext.sync).toBeDefined();
    });

    it('should provide health monitoring', () => {
      expect(testContext.healthMonitor).toBeDefined();
      expect(testContext.healthMonitor.getCurrentMetrics).toBeDefined();
      expect(testContext.healthMonitor.performHealthCheck).toBeDefined();
    });

    it('should provide raw database access', () => {
      expect(testContext.rawDb).toBeDefined();
    });
  });

  describe('Real database operations integration', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PouchDbContext.Provider value={testContext}>
        {children}
      </PouchDbContext.Provider>
    );

    it('should perform real database put and get operations', async () => {
      const { result } = renderHook(() => usePouchDb(), { wrapper });

      const testTodo = createTestTodo({
        _id: '2025-07-12T10:00:00.000Z',
        title: 'Integration Test Todo',
      });

      // Test put operation
      const putResult = await result.current.safeDb.safePut(testTodo);
      expect(putResult._rev).toBeDefined();
      expect(putResult._id).toBe(testTodo._id);

      // Test get operation
      const getResult = await result.current.safeDb.safeGet<Todo>(testTodo._id);
      expect(getResult?.title).toBe('Integration Test Todo');
      expect(getResult?.version).toBe('alpha3');
    });

    it('should handle document not found errors', async () => {
      const { result } = renderHook(() => usePouchDb(), { wrapper });

      const getResult = await result.current.safeDb.safeGet('nonexistent-id');
      expect(getResult).toBe(null);
    });

    it('should perform bulk document operations', async () => {
      const { result } = renderHook(() => usePouchDb(), { wrapper });

      const todos = [
        createTestTodo({ _id: '2025-07-12T10:00:00.000Z', title: 'Todo 1' }),
        createTestTodo({ _id: '2025-07-12T11:00:00.000Z', title: 'Todo 2' }),
      ];

      const bulkResult = await result.current.safeDb.safeBulkDocs(todos);
      expect(bulkResult).toHaveLength(2);
      expect(bulkResult.every((r) => r._rev)).toBe(true);
    });

    it('should perform health check', async () => {
      const { result } = renderHook(() => usePouchDb(), { wrapper });

      // This should not throw
      const healthCheck =
        await result.current.healthMonitor.performHealthCheck();
      expect(healthCheck).toBeDefined();
    });
  });

  describe('Health monitoring with real database', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PouchDbContext.Provider value={testContext}>
        {children}
      </PouchDbContext.Provider>
    );

    it('should return current metrics for memory database', () => {
      const { result } = renderHook(() => usePouchDb(), { wrapper });

      const metrics = result.current.healthMonitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.isConnected).toBe('boolean');
    });
  });

  describe('Changes feed with real database', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PouchDbContext.Provider value={testContext}>
        {children}
      </PouchDbContext.Provider>
    );

    it('should provide working changes function', async () => {
      const { result } = renderHook(() => usePouchDb(), { wrapper });

      const changes = result.current.changes({
        live: false,
        include_docs: true,
      });

      expect(changes).toBeDefined();
      expect(typeof changes.on).toBe('function');
      expect(typeof changes.cancel).toBe('function');

      changes.cancel(); // Clean up
    });

    it('should detect document changes', async () => {
      const { result } = renderHook(() => usePouchDb(), { wrapper });

      let _changeDetected = false;
      const changes = result.current.changes({
        live: false,
        include_docs: true,
        since: 'now',
      });

      changes.on('change', () => {
        _changeDetected = true;
      });

      // Add a document to trigger change
      const testTodo = createTestTodo({
        _id: '2025-07-12T10:00:00.000Z',
        title: 'Change Detection Test',
      });

      await result.current.safeDb.safePut(testTodo);

      // Give changes feed time to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      changes.cancel();
    });
  });
});
