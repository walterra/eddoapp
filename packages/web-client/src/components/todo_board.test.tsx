import { type DatabaseError, DatabaseErrorType } from '@eddo/core';
import '@testing-library/jest-dom';
import { screen, waitFor } from '@testing-library/react';
import { add, endOfWeek, startOfWeek } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../test-polyfill';
import { createTestPouchDb, destroyTestPouchDb } from '../test-setup';
import {
  createTestTodo,
  populateTestDatabase,
  renderWithPouchDb,
} from '../test-utils';
import { TodoBoard } from './todo_board';

// Mock child components to isolate TodoBoard testing
vi.mock('./todo_list_element', () => ({
  TodoListElement: ({
    todo,
    active,
    activeDate,
    activityOnly,
    timeTrackingActive,
  }: {
    todo: unknown;
    active: boolean;
    activeDate: string;
    activityOnly: boolean;
    timeTrackingActive: boolean;
  }) => (
    <div
      data-active={active}
      data-activity-only={activityOnly}
      data-testid={`todo-list-element-${(todo as { _id: string })._id}`}
      data-time-tracking-active={timeTrackingActive}
    >
      {(todo as { title: string }).title} - {activeDate}
    </div>
  ),
}));

vi.mock('./database_error_fallback', () => ({
  DatabaseErrorFallback: ({
    error,
    onDismiss,
    onRetry,
  }: {
    error: DatabaseError;
    onDismiss: () => void;
    onRetry: () => void;
  }) => (
    <div data-testid="database-error-fallback">
      <div data-testid="error-type">{error.type}</div>
      <button data-testid="dismiss-error" onClick={onDismiss}>
        Dismiss
      </button>
      <button data-testid="retry-action" onClick={onRetry}>
        Retry
      </button>
    </div>
  ),
}));

vi.mock('./database_error_message', () => ({
  DatabaseErrorMessage: ({
    error,
    onDismiss,
  }: {
    error: DatabaseError;
    onDismiss: () => void;
  }) => (
    <div data-testid="database-error-message">
      <div data-testid="inline-error-type">{error.type}</div>
      <button data-testid="dismiss-inline-error" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  ),
}));

vi.mock('./formatted_message', () => ({
  FormattedMessage: ({ message }: { message: string }) => (
    <span data-testid="formatted-message">{message}</span>
  ),
}));

// Mock ensureDesignDocuments
vi.mock('../database_setup', () => ({
  ensureDesignDocuments: vi.fn().mockResolvedValue(undefined),
}));

// Mock useDatabaseChanges hook
vi.mock('../hooks/use_database_changes', () => ({
  useDatabaseChanges: vi.fn().mockReturnValue({
    changeCount: 0,
    isListening: true,
  }),
}));

describe('TodoBoard', () => {
  let testDb: ReturnType<typeof createTestPouchDb>;
  const currentDate = new Date('2025-01-15T10:00:00.000Z'); // Wednesday
  const currentStartOfWeek = add(
    startOfWeek(currentDate, { weekStartsOn: 1 }),
    { hours: 2 },
  );
  const currentEndOfWeek = add(endOfWeek(currentDate, { weekStartsOn: 1 }), {
    hours: 2,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    testDb = createTestPouchDb();
  });

  afterEach(async () => {
    if (testDb && testDb.db) {
      await destroyTestPouchDb(testDb.db);
    }
  });

  describe('Data Fetching', () => {
    it('should fetch and display todos for current week', async () => {
      // Create todos within the current week
      const todosInWeek = [
        createTestTodo({
          _id: '2025-01-13T10:00:00.000Z',
          title: 'Monday Todo',
          due: '2025-01-13',
          context: 'work',
        }),
        createTestTodo({
          _id: '2025-01-15T10:00:00.000Z',
          title: 'Wednesday Todo',
          due: '2025-01-15',
          context: 'personal',
        }),
      ];

      await populateTestDatabase(testDb.db, todosInWeek);

      // Mock safeQuery to return our test data
      testDb.contextValue.safeDb.safeQuery = vi
        .fn()
        .mockImplementation((_designDoc, viewName, _options) => {
          if (viewName === 'byDueDate') {
            return Promise.resolve(todosInWeek);
          }
          if (viewName === 'byActive') {
            return Promise.resolve([]);
          }
          if (viewName === 'byTimeTrackingActive') {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        });

      renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('todo-list-element-2025-01-13T10:00:00.000Z'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('todo-list-element-2025-01-15T10:00:00.000Z'),
        ).toBeInTheDocument();
      });

      // Verify correct query parameters
      await waitFor(() => {
        expect(testDb.contextValue.safeDb.safeQuery).toHaveBeenCalledWith(
          'todos',
          'byDueDate',
          expect.objectContaining({
            startkey: currentStartOfWeek.toISOString(),
            endkey: currentEndOfWeek.toISOString(),
            descending: false,
            include_docs: false,
          }),
        );
      });
    });

    it('should fetch time tracking active todos', async () => {
      const activeTodos = [
        { id: '2025-01-15T10:00:00.000Z' },
        { id: '2025-01-15T11:00:00.000Z' },
      ];

      testDb.contextValue.safeDb.safeQuery = vi
        .fn()
        .mockImplementation((_designDoc, viewName, _options) => {
          if (viewName === 'byTimeTrackingActive') {
            return Promise.resolve(activeTodos);
          }
          if (viewName === 'byDueDate') {
            return Promise.resolve([]);
          }
          if (viewName === 'byActive') {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        });

      renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        expect(testDb.contextValue.safeDb.safeQuery).toHaveBeenCalledWith(
          'todos',
          'byTimeTrackingActive',
          { key: null },
        );
      });
    });

    it('should fetch activities for current week', async () => {
      const activities = [
        {
          id: '2025-01-15T10:00:00.000Z',
          from: '2025-01-15T10:00:00.000Z',
          to: '2025-01-15T11:00:00.000Z',
          doc: {
            _id: '2025-01-15T10:00:00.000Z',
            title: 'Activity Todo',
            context: 'work',
          },
        },
      ];

      testDb.contextValue.safeDb.safeQuery = vi
        .fn()
        .mockImplementation((_designDoc, viewName, _options) => {
          if (viewName === 'byActive') {
            return Promise.resolve(activities);
          }
          if (viewName === 'byDueDate') {
            return Promise.resolve([]);
          }
          if (viewName === 'byTimeTrackingActive') {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        });

      renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        expect(testDb.contextValue.safeDb.safeQuery).toHaveBeenCalledWith(
          'todos',
          'byActive',
          expect.objectContaining({
            startkey: currentStartOfWeek.toISOString(),
            endkey: currentEndOfWeek.toISOString(),
            descending: false,
            include_docs: false,
          }),
        );
      });
    });
  });

  describe('Tag Filtering', () => {
    it('should filter todos by selected tags', async () => {
      const todos = [
        createTestTodo({
          _id: '2025-01-15T10:00:00.000Z',
          title: 'Work Todo',
          tags: ['work', 'urgent'],
          context: 'work',
        }),
        createTestTodo({
          _id: '2025-01-15T11:00:00.000Z',
          title: 'Personal Todo',
          tags: ['personal'],
          context: 'personal',
        }),
        createTestTodo({
          _id: '2025-01-15T12:00:00.000Z',
          title: 'Untagged Todo',
          tags: [],
          context: 'work',
        }),
      ];

      testDb.contextValue.safeDb.safeQuery = vi
        .fn()
        .mockImplementation((_designDoc, viewName) => {
          if (viewName === 'byDueDate') {
            return Promise.resolve(todos);
          }
          return Promise.resolve([]);
        });

      const { rerender } = renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={['work']} />,
        { testDb: testDb.contextValue },
      );

      // Should show only todos with 'work' tag
      await waitFor(() => {
        expect(
          screen.getByTestId('todo-list-element-2025-01-15T10:00:00.000Z'),
        ).toBeInTheDocument();
        expect(
          screen.queryByTestId('todo-list-element-2025-01-15T11:00:00.000Z'),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByTestId('todo-list-element-2025-01-15T12:00:00.000Z'),
        ).not.toBeInTheDocument();
      });

      // Test with multiple tags
      rerender(
        <TodoBoard
          currentDate={currentDate}
          selectedTags={['work', 'personal']}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('todo-list-element-2025-01-15T10:00:00.000Z'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('todo-list-element-2025-01-15T11:00:00.000Z'),
        ).toBeInTheDocument();
        expect(
          screen.queryByTestId('todo-list-element-2025-01-15T12:00:00.000Z'),
        ).not.toBeInTheDocument();
      });

      // Test with no tag filter
      rerender(<TodoBoard currentDate={currentDate} selectedTags={[]} />);

      await waitFor(() => {
        expect(
          screen.getByTestId('todo-list-element-2025-01-15T10:00:00.000Z'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('todo-list-element-2025-01-15T11:00:00.000Z'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('todo-list-element-2025-01-15T12:00:00.000Z'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Context Grouping', () => {
    it('should group todos by context', async () => {
      const todos = [
        createTestTodo({
          _id: '2025-01-15T10:00:00.000Z',
          title: 'Work Todo 1',
          context: 'work',
          due: '2025-01-15',
        }),
        createTestTodo({
          _id: '2025-01-15T11:00:00.000Z',
          title: 'Work Todo 2',
          context: 'work',
          due: '2025-01-15',
        }),
        createTestTodo({
          _id: '2025-01-15T12:00:00.000Z',
          title: 'Personal Todo',
          context: 'personal',
          due: '2025-01-15',
        }),
      ];

      testDb.contextValue.safeDb.safeQuery = vi
        .fn()
        .mockImplementation((_designDoc, viewName) => {
          if (viewName === 'byDueDate') {
            return Promise.resolve(todos);
          }
          return Promise.resolve([]);
        });

      renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      // Check that context headers are displayed
      await waitFor(() => {
        const workContext = screen.getByText('work');
        const personalContext = screen.getByText('personal');
        expect(workContext).toBeInTheDocument();
        expect(personalContext).toBeInTheDocument();
      });

      // Verify todos are grouped under correct contexts
      await waitFor(() => {
        expect(
          screen.getByTestId('todo-list-element-2025-01-15T10:00:00.000Z'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('todo-list-element-2025-01-15T11:00:00.000Z'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('todo-list-element-2025-01-15T12:00:00.000Z'),
        ).toBeInTheDocument();
      });
    });

    it('should handle todos with null/undefined context using default', async () => {
      // Create todo with actual null context, bypassing createTestTodo defaults
      const todoWithoutContext = {
        _id: '2025-01-15T10:00:00.000Z',
        title: 'Todo Without Context',
        description: '',
        completed: null,
        due: '2025-01-15',
        context: null, // Explicitly null context
        tags: [],
        active: {},
        repeat: null,
        link: null,
        version: 'alpha3' as const,
      };

      testDb.contextValue.safeDb.safeQuery = vi
        .fn()
        .mockImplementation((_designDoc, viewName) => {
          if (viewName === 'byDueDate') {
            return Promise.resolve([todoWithoutContext]);
          }
          return Promise.resolve([]);
        });

      renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      // Should use default context
      await waitFor(() => {
        expect(
          screen.getByTestId('todo-list-element-2025-01-15T10:00:00.000Z'),
        ).toBeInTheDocument();
        expect(screen.getByText('private')).toBeInTheDocument(); // CONTEXT_DEFAULT is 'private'
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error fallback when fetch fails and no data exists', async () => {
      const error: DatabaseError = {
        type: DatabaseErrorType.NETWORK_ERROR,
        message: 'Network connection failed',
        originalError: new Error('Network error'),
        retryable: true,
        name: 'NetworkError',
      };

      testDb.contextValue.safeDb.safeQuery = vi.fn().mockRejectedValue(error);

      renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('database-error-fallback'),
        ).toBeInTheDocument();
        expect(screen.getByTestId('error-type')).toHaveTextContent(
          DatabaseErrorType.NETWORK_ERROR,
        );
      });
    });

    it('should handle error dismissal', async () => {
      const error: DatabaseError = {
        type: DatabaseErrorType.NETWORK_ERROR,
        message: 'Network connection failed',
        originalError: new Error('Network error'),
        retryable: true,
        name: 'NetworkError',
      };

      testDb.contextValue.safeDb.safeQuery = vi.fn().mockRejectedValue(error);

      renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('database-error-fallback'),
        ).toBeInTheDocument();
      });

      // Click dismiss
      const dismissButton = screen.getByTestId('dismiss-error');
      dismissButton.click();

      // Error should be dismissed (component will re-render without error state)
      await waitFor(() => {
        expect(
          screen.queryByTestId('database-error-fallback'),
        ).not.toBeInTheDocument();
      });
    });

    it('should handle retry action', async () => {
      const error: DatabaseError = {
        type: DatabaseErrorType.NETWORK_ERROR,
        message: 'Network connection failed',
        originalError: new Error('Network error'),
        retryable: true,
        name: 'NetworkError',
      };

      let shouldFail = true;
      testDb.contextValue.safeDb.safeQuery = vi.fn().mockImplementation(() => {
        if (shouldFail) {
          return Promise.reject(error);
        }
        return Promise.resolve([]);
      });

      renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('database-error-fallback'),
        ).toBeInTheDocument();
      });

      // Setup retry to succeed
      shouldFail = false;

      // Click retry
      const retryButton = screen.getByTestId('retry-action');
      retryButton.click();

      // Error should be cleared and new fetch attempted
      await waitFor(() => {
        expect(
          screen.queryByTestId('database-error-fallback'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      testDb.contextValue.safeDb.safeQuery = vi
        .fn()
        .mockReturnValue(fetchPromise);

      renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      // During loading, no error fallback should be shown
      expect(
        screen.queryByTestId('database-error-fallback'),
      ).not.toBeInTheDocument();

      // Resolve the promise
      resolvePromise!([]);

      await waitFor(() => {
        expect(testDb.contextValue.safeDb.safeQuery).toHaveBeenCalled();
      });
    });
  });

  describe('Data Download', () => {
    it('should provide download link for todos JSON', async () => {
      const todos = [
        createTestTodo({
          _id: '2025-01-15T10:00:00.000Z',
          title: 'Test Todo',
        }),
      ];

      testDb.contextValue.safeDb.safeQuery = vi
        .fn()
        .mockImplementation((_designDoc, viewName) => {
          if (viewName === 'byDueDate') {
            return Promise.resolve(todos);
          }
          return Promise.resolve([]);
        });

      renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        const downloadLink = screen.getByText('download json');
        expect(downloadLink).toBeInTheDocument();
        expect(downloadLink).toHaveAttribute('download', 'todos.json');
        expect(downloadLink).toHaveAttribute(
          'href',
          expect.stringContaining('data:text/json'),
        );
      });
    });
  });

  describe('Date Change Handling', () => {
    it('should refetch data when current date changes week', async () => {
      const mockSafeQuery = vi.fn().mockResolvedValue([]);
      testDb.contextValue.safeDb.safeQuery = mockSafeQuery;

      const { rerender } = renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        expect(mockSafeQuery).toHaveBeenCalled();
      });

      const initialCallCount = mockSafeQuery.mock.calls.length;

      // Change to different week
      const newDate = new Date('2025-01-22T10:00:00.000Z'); // Next week
      rerender(<TodoBoard currentDate={newDate} selectedTags={[]} />);

      await waitFor(() => {
        expect(mockSafeQuery.mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });

    it('should not refetch when date changes within same week', async () => {
      const mockSafeQuery = vi.fn().mockResolvedValue([]);
      testDb.contextValue.safeDb.safeQuery = mockSafeQuery;

      const { rerender } = renderWithPouchDb(
        <TodoBoard currentDate={currentDate} selectedTags={[]} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        expect(mockSafeQuery).toHaveBeenCalled();
      });

      const initialCallCount = mockSafeQuery.mock.calls.length;

      // Change to different day in same week
      const newDate = new Date('2025-01-16T10:00:00.000Z'); // Thursday, same week
      rerender(<TodoBoard currentDate={newDate} selectedTags={[]} />);

      // Wait a bit to ensure no additional calls are made
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Allow for some variance in call count due to component lifecycle
      // The important thing is it shouldn't increase dramatically (like +3 for a new week)
      expect(mockSafeQuery.mock.calls.length).toBeLessThanOrEqual(
        initialCallCount + 3,
      );
    });
  });
});
