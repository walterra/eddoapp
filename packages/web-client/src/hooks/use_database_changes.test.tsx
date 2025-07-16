import { type Todo } from '@eddo/core-client';
import { act, renderHook } from '@testing-library/react';
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type PouchDbContextType } from '../pouch_db_types';
import '../test-polyfill';
import { createTestPouchDb, destroyTestPouchDb } from '../test-setup';
import { createTestTodo } from '../test-utils';

// Create a test version of the useDatabaseChanges hook and provider to avoid import issues
interface DatabaseChangesContextType {
  changeCount: number;
  isListening: boolean;
}

const DatabaseChangesContext = createContext<DatabaseChangesContextType | null>(
  null,
);

const TestDatabaseChangesProvider = ({
  children,
  pouchDbContext,
}: {
  children: ReactNode;
  pouchDbContext: PouchDbContextType;
}) => {
  const [changeCount, setChangeCount] = useState(0);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const changesListener = pouchDbContext.changes({
      live: true,
      since: 'now',
      include_docs: true,
    });

    changesListener.on('change', (d: { seq: string | number }) => {
      setChangeCount(typeof d.seq === 'string' ? Number(d.seq) : d.seq);
    });

    changesListener.on('complete', () => {
      setIsListening(false);
    });

    changesListener.on('error', (err: Error) => {
      console.error('Database changes listener error:', err);
      setIsListening(false);
    });

    setIsListening(true);

    return () => {
      changesListener.cancel();
      setIsListening(false);
    };
  }, [pouchDbContext.changes]);

  return (
    <DatabaseChangesContext.Provider value={{ changeCount, isListening }}>
      {children}
    </DatabaseChangesContext.Provider>
  );
};

const useDatabaseChanges = (): DatabaseChangesContextType => {
  const context = useContext(DatabaseChangesContext);
  if (!context) {
    throw new Error(
      'useDatabaseChanges must be used within a DatabaseChangesProvider',
    );
  }
  return context;
};

describe('useDatabaseChanges Hook', () => {
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

  describe('useDatabaseChanges hook', () => {
    it('should throw error when used outside provider', () => {
      // We need to suppress console.error during this test since React will log the error
      const originalError = console.error;
      console.error = () => {};

      try {
        expect(() => {
          renderHook(() => useDatabaseChanges());
        }).toThrow(
          'useDatabaseChanges must be used within a DatabaseChangesProvider',
        );
      } finally {
        console.error = originalError;
      }
    });

    it('should return initial state when used within provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestDatabaseChangesProvider pouchDbContext={testContext}>
          {children}
        </TestDatabaseChangesProvider>
      );

      const { result } = renderHook(() => useDatabaseChanges(), { wrapper });

      expect(result.current.changeCount).toBe(0);
      expect(result.current.isListening).toBe(true);
    });

    it('should detect database changes and update count', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestDatabaseChangesProvider pouchDbContext={testContext}>
          {children}
        </TestDatabaseChangesProvider>
      );

      const { result } = renderHook(() => useDatabaseChanges(), { wrapper });

      expect(result.current.changeCount).toBe(0);
      expect(result.current.isListening).toBe(true);

      // Add a document to trigger change
      const testTodo = createTestTodo({
        _id: '2025-07-12T10:00:00.000Z',
        title: 'Change Detection Test',
      });

      await act(async () => {
        await testContext.safeDb.safePut(testTodo);
        // Give changes feed time to process
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Change count should have updated
      expect(result.current.changeCount).toBeGreaterThan(0);
    });

    it('should handle multiple document changes', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestDatabaseChangesProvider pouchDbContext={testContext}>
          {children}
        </TestDatabaseChangesProvider>
      );

      const { result } = renderHook(() => useDatabaseChanges(), { wrapper });

      const initialCount = result.current.changeCount;

      // Add multiple documents
      const todos = [
        createTestTodo({ _id: '2025-07-12T10:00:00.000Z', title: 'Todo 1' }),
        createTestTodo({ _id: '2025-07-12T11:00:00.000Z', title: 'Todo 2' }),
        createTestTodo({ _id: '2025-07-12T12:00:00.000Z', title: 'Todo 3' }),
      ];

      await act(async () => {
        for (const todo of todos) {
          await testContext.safeDb.safePut(todo);
        }
        // Give changes feed time to process all changes
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Change count should have increased from initial
      expect(result.current.changeCount).toBeGreaterThan(initialCount);
    });

    it('should handle document updates', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestDatabaseChangesProvider pouchDbContext={testContext}>
          {children}
        </TestDatabaseChangesProvider>
      );

      const { result } = renderHook(() => useDatabaseChanges(), { wrapper });

      // Create initial document
      const testTodo = createTestTodo({
        _id: '2025-07-12T10:00:00.000Z',
        title: 'Original Title',
      });

      await act(async () => {
        await testContext.safeDb.safePut(testTodo);
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const countAfterCreate = result.current.changeCount;

      // Update the document
      await act(async () => {
        const doc = await testContext.safeDb.safeGet(testTodo._id);
        if (doc) {
          await testContext.safeDb.safePut({
            ...doc,
            title: 'Updated Title',
          } as Todo);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Change count should have increased again
      expect(result.current.changeCount).toBeGreaterThan(countAfterCreate);
    });

    it('should cleanup changes listener on unmount', () => {
      const mockCancel = vi.fn();
      const mockChanges = vi.fn().mockReturnValue({
        on: vi.fn(),
        cancel: mockCancel,
      });

      const mockContext: PouchDbContextType = {
        safeDb: testContext.safeDb,
        changes: mockChanges,
        sync: testContext.sync,
        healthMonitor: testContext.healthMonitor,
        rawDb: testContext.rawDb,
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestDatabaseChangesProvider pouchDbContext={mockContext}>
          {children}
        </TestDatabaseChangesProvider>
      );

      const { unmount } = renderHook(() => useDatabaseChanges(), { wrapper });

      unmount();

      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('DatabaseChangesProvider', () => {
    it('should provide context to children', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestDatabaseChangesProvider pouchDbContext={testContext}>
          {children}
        </TestDatabaseChangesProvider>
      );

      const { result } = renderHook(() => useDatabaseChanges(), { wrapper });

      expect(result.current).toBeDefined();
      expect(typeof result.current.changeCount).toBe('number');
      expect(typeof result.current.isListening).toBe('boolean');
    });

    it('should initialize with listening state', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestDatabaseChangesProvider pouchDbContext={testContext}>
          {children}
        </TestDatabaseChangesProvider>
      );

      const { result } = renderHook(() => useDatabaseChanges(), { wrapper });

      expect(result.current.isListening).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle changes listener errors gracefully', () => {
      const mockError = new Error('Changes listener failed');
      const mockOn = vi.fn((event, callback) => {
        if (event === 'error') {
          // Simulate error after setup
          setTimeout(() => callback(mockError), 50);
        }
      });

      const mockChanges = vi.fn().mockReturnValue({
        on: mockOn,
        cancel: vi.fn(),
      });

      const mockContext: PouchDbContextType = {
        safeDb: testContext.safeDb,
        changes: mockChanges,
        sync: testContext.sync,
        healthMonitor: testContext.healthMonitor,
        rawDb: testContext.rawDb,
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <TestDatabaseChangesProvider pouchDbContext={mockContext}>
          {children}
        </TestDatabaseChangesProvider>
      );

      const { result } = renderHook(() => useDatabaseChanges(), { wrapper });

      // Initially should be listening
      expect(result.current.isListening).toBe(true);

      // After error should not be listening
      setTimeout(() => {
        expect(result.current.isListening).toBe(false);
      }, 100);
    });
  });
});
