import { type TodoAlpha3 } from '@eddo/shared';
import '@testing-library/jest-dom';
import { renderHook, waitFor } from '@testing-library/react';
import React, {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PouchDbContext, type PouchDbContextType } from '../pouch_db_types';
import '../test-polyfill';
import { createTestPouchDb, destroyTestPouchDb } from '../test-setup';
import { useTags } from './use_tags';

// Create a test version of the DatabaseChangesProvider for testing
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

    changesListener.on(
      'change',
      (d: PouchDB.Core.ChangesResponseChange<Record<string, unknown>>) => {
        setChangeCount(typeof d.seq === 'string' ? Number(d.seq) : d.seq);
      },
    );

    changesListener.on('complete', () => {
      setIsListening(false);
    });

    changesListener.on('error', (err: Error) => {
      console.error('Database changes listener error:', err);
      setIsListening(false);
    });

    setIsListening(true);

    return () => {
      try {
        changesListener.cancel();
      } catch (error) {
        console.warn('Error cancelling changes listener:', error);
      }
    };
  }, [pouchDbContext]);

  return (
    <DatabaseChangesContext.Provider value={{ changeCount, isListening }}>
      {children}
    </DatabaseChangesContext.Provider>
  );
};

// Mock the useDatabaseChanges hook to use our test context
vi.mock('./use_database_changes', () => ({
  useDatabaseChanges: () => {
    const context = useContext(DatabaseChangesContext);
    if (!context) {
      throw new Error(
        'useDatabaseChanges must be used within a DatabaseChangesProvider',
      );
    }
    return context;
  },
}));

describe('useTags', () => {
  let testDb: PouchDB.Database;
  let contextValue: PouchDbContextType;

  beforeEach(async () => {
    const setup = createTestPouchDb();
    testDb = setup.db;
    contextValue = setup.contextValue;
  });

  afterEach(async () => {
    await destroyTestPouchDb(testDb);
  });

  const renderHookWithContext = () => {
    return renderHook(() => useTags(), {
      wrapper: ({ children }) => (
        <PouchDbContext.Provider value={contextValue}>
          <TestDatabaseChangesProvider pouchDbContext={contextValue}>
            {children}
          </TestDatabaseChangesProvider>
        </PouchDbContext.Provider>
      ),
    });
  };

  const createTestTodo = (
    id: string,
    tags: string[] = [],
    title = 'Test Todo',
  ): TodoAlpha3 =>
    ({
      _id: id,
      active: {},
      completed: null,
      context: 'work',
      description: '',
      due: new Date().toISOString(),
      link: null,
      repeat: null,
      tags,
      title,
      version: 'alpha3',
    }) as TodoAlpha3;

  describe('Initial state', () => {
    it('starts with loading state', () => {
      const { result } = renderHookWithContext();

      expect(result.current.isLoading).toBe(true);
      expect(result.current.allTags).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Tag fetching', () => {
    it('fetches and returns unique sorted tags from todos', async () => {
      // Add test todos with various tags
      await testDb.put(createTestTodo('todo1', ['work', 'urgent']));
      await testDb.put(createTestTodo('todo2', ['personal', 'shopping']));
      await testDb.put(createTestTodo('todo3', ['work', 'meeting']));

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.allTags).toEqual([
        'meeting',
        'personal',
        'shopping',
        'urgent',
        'work',
      ]);
      expect(result.current.error).toBeNull();
    });

    it('handles todos with no tags', async () => {
      await testDb.put(createTestTodo('todo1', []));
      await testDb.put(createTestTodo('todo2')); // No tags property

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.allTags).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('removes duplicates and sorts tags alphabetically', async () => {
      await testDb.put(createTestTodo('todo1', ['zebra', 'alpha', 'beta']));
      await testDb.put(createTestTodo('todo2', ['alpha', 'gamma', 'beta']));
      await testDb.put(createTestTodo('todo3', ['zebra', 'alpha']));

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.allTags).toEqual([
        'alpha',
        'beta',
        'gamma',
        'zebra',
      ]);
    });

    it('trims whitespace from tags', async () => {
      await testDb.put(
        createTestTodo('todo1', ['  work  ', ' urgent', 'home ']),
      );
      await testDb.put(createTestTodo('todo2', [' work ', '  meeting  ']));

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.allTags).toEqual([
        'home',
        'meeting',
        'urgent',
        'work',
      ]);
    });

    it('filters out empty tags after trimming', async () => {
      await testDb.put(createTestTodo('todo1', ['work', '', '   ', 'urgent']));
      await testDb.put(createTestTodo('todo2', ['meeting', ' ', 'personal']));

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.allTags).toEqual([
        'meeting',
        'personal',
        'urgent',
        'work',
      ]);
    });

    it('handles non-array tags gracefully', async () => {
      // Create todo with malformed tags
      const malformedTodo = createTestTodo('todo1', ['work']);
      (malformedTodo as unknown as { tags: string }).tags = 'not-an-array';
      await testDb.put(malformedTodo);

      await testDb.put(createTestTodo('todo2', ['personal', 'valid']));

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.allTags).toEqual(['personal', 'valid']);
    });

    it('handles empty database', async () => {
      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.allTags).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('handles database errors gracefully', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Mock safeAllDocs to throw an error
      const mockError = new Error('Database connection failed');
      vi.spyOn(contextValue.safeDb, 'safeAllDocs').mockRejectedValue(mockError);

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.allTags).toEqual([]);
      expect(result.current.error).toEqual(mockError);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch tags:',
        mockError,
      );

      consoleSpy.mockRestore();
    });

    it.skip('resets error on successful refetch', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // First, simulate an error
      const mockError = new Error('Network error');
      vi.spyOn(contextValue.safeDb, 'safeAllDocs')
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce([createTestTodo('todo1', ['work'])]);

      const { result } = renderHookWithContext();

      // Wait for error state
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toEqual(mockError);

      // Add a todo to the database to trigger a real change
      await testDb.put(createTestTodo('todo1', ['work']));

      // Wait for successful refetch
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.allTags).toEqual(['work']);

      consoleSpy.mockRestore();
    });
  });

  describe('Database change reactivity', () => {
    it('refetches tags when database changes', async () => {
      // Initial data
      await testDb.put(createTestTodo('todo1', ['initial']));

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.allTags).toEqual(['initial']);
      });

      // Add new todo with different tags
      await testDb.put(createTestTodo('todo2', ['added', 'new']));

      // The hook should automatically refetch due to useDatabaseChanges dependency
      await waitFor(() => {
        expect(result.current.allTags).toEqual(['added', 'initial', 'new']);
      });
    });

    it('updates tags when todos are modified', async () => {
      // Initial todo
      await testDb.put(createTestTodo('todo1', ['old-tag']));

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.allTags).toEqual(['old-tag']);
      });

      // Update the todo with new tags
      const updatedTodo = createTestTodo('todo1', ['new-tag', 'updated']);
      updatedTodo._rev = (await testDb.get('todo1'))._rev;
      await testDb.put(updatedTodo);

      await waitFor(() => {
        expect(result.current.allTags).toEqual(['new-tag', 'updated']);
      });
    });

    it('removes tags when todos are deleted', async () => {
      // Add todos with tags
      await testDb.put(createTestTodo('todo1', ['keep', 'remove']));
      await testDb.put(createTestTodo('todo2', ['keep', 'different']));

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.allTags).toEqual(['different', 'keep', 'remove']);
      });

      // Delete one todo
      const todo1 = await testDb.get('todo1');
      await testDb.remove(todo1);

      await waitFor(() => {
        expect(result.current.allTags).toEqual(['different', 'keep']);
      });
    });
  });

  describe('Performance and edge cases', () => {
    it('handles large number of tags efficiently', async () => {
      // Create many todos with various tags
      const todos = Array.from({ length: 100 }, (_, i) =>
        createTestTodo(`todo${i}`, [`tag${i % 10}`, `category${i % 5}`]),
      );

      for (const todo of todos) {
        await testDb.put(todo);
      }

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have unique tags only
      const expectedTags = [
        ...Array.from({ length: 5 }, (_, i) => `category${i}`),
        ...Array.from({ length: 10 }, (_, i) => `tag${i}`),
      ].sort();

      expect(result.current.allTags).toEqual(expectedTags);
    });

    it('handles special characters in tags', async () => {
      await testDb.put(
        createTestTodo('todo1', [
          'tag@symbol',
          'tag#hash',
          'tag$dollar',
          'tag&amp',
          'tag/slash',
          'tag\\backslash',
        ]),
      );

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.allTags).toEqual([
        'tag#hash',
        'tag$dollar',
        'tag&amp',
        'tag/slash',
        'tag@symbol',
        'tag\\backslash',
      ]);
    });

    it('handles unicode and emoji tags', async () => {
      await testDb.put(
        createTestTodo('todo1', [
          '🔥urgent',
          '📝notes',
          'français',
          '日本語',
          'español',
        ]),
      );

      const { result } = renderHookWithContext();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.allTags).toHaveLength(5);
      expect(result.current.allTags).toContain('🔥urgent');
      expect(result.current.allTags).toContain('📝notes');
      expect(result.current.allTags).toContain('français');
    });
  });
});
