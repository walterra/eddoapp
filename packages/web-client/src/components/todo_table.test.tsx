import '@testing-library/jest-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../test-polyfill';
import { createTestPouchDb } from '../test-setup';
import { createTestTodo, renderWithPouchDb } from '../test-utils';
import { TodoTable } from './todo_table';

// Mock child components
vi.mock('./todo_edit_flyout', () => ({
  TodoEditFlyout: ({ show, onClose }: { show: boolean; onClose: () => void }) =>
    show ? (
      <div data-testid="todo-edit-flyout">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('./formatted_message', () => ({
  FormattedMessage: ({ message }: { message: string }) => <span>{message}</span>,
}));

vi.mock('./tag_display', () => ({
  TagDisplay: ({ tags }: { tags: string[] }) => <div>{tags.join(', ')}</div>,
}));

vi.mock('./database_error_fallback', () => ({
  DatabaseErrorFallback: () => <div data-testid="error-fallback">Error</div>,
}));

vi.mock('./database_error_message', () => ({
  DatabaseErrorMessage: () => <div data-testid="error-message">Error</div>,
}));

vi.mock('../database_setup', () => ({
  ensureDesignDocuments: vi.fn().mockResolvedValue(undefined),
}));

// Mock data hooks
vi.mock('../hooks/use_todos_by_week', () => ({
  useTodosByWeek: vi.fn(),
}));

vi.mock('../hooks/use_activities_by_week', () => ({
  useActivitiesByWeek: vi.fn(),
}));

vi.mock('../hooks/use_time_tracking_active', () => ({
  useTimeTrackingActive: vi.fn(),
}));

vi.mock('../hooks/use_active_timer', () => ({
  useActiveTimer: vi.fn().mockReturnValue({ counter: 0 }),
}));

vi.mock('../hooks/use_database_changes', () => ({
  DatabaseChangesProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useDatabaseChanges: vi.fn().mockReturnValue({ changeCount: 0, isListening: true }),
}));

import { useActivitiesByWeek } from '../hooks/use_activities_by_week';
import { useTimeTrackingActive } from '../hooks/use_time_tracking_active';
import { useTodosByWeek } from '../hooks/use_todos_by_week';

describe('TodoTable', () => {
  const defaultProps = {
    currentDate: new Date('2025-01-15T10:00:00.000Z'),
    selectedTags: [] as string[],
    selectedContexts: [] as string[],
    selectedStatus: 'all' as const,
    selectedTimeRange: { type: 'current-week' as const },
    selectedColumns: ['title', 'due', 'tags', 'timeTracked', 'status'],
  };

  let testDb: ReturnType<typeof createTestPouchDb>;

  beforeEach(() => {
    testDb = createTestPouchDb();
    vi.clearAllMocks();

    // Default mock returns
    vi.mocked(useTodosByWeek).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTodosByWeek>);

    vi.mocked(useActivitiesByWeek).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useActivitiesByWeek>);

    vi.mocked(useTimeTrackingActive).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTimeTrackingActive>);
  });

  describe('Rendering', () => {
    it('should render table with todos grouped by context', async () => {
      const todos = [
        createTestTodo({
          _id: '2025-01-13T10:00:00.000Z',
          title: 'Work todo',
          context: 'work',
          due: '2025-01-13T10:00:00.000Z',
        }),
        createTestTodo({
          _id: '2025-01-14T10:00:00.000Z',
          title: 'Home todo',
          context: 'home',
          due: '2025-01-14T10:00:00.000Z',
        }),
      ];

      vi.mocked(useTodosByWeek).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByWeek>);

      renderWithPouchDb(<TodoTable {...defaultProps} />, { testDb: testDb.contextValue });

      await waitFor(() => {
        expect(screen.getByText('work')).toBeInTheDocument();
        expect(screen.getByText('home')).toBeInTheDocument();
        expect(screen.getByText('Work todo')).toBeInTheDocument();
        expect(screen.getByText('Home todo')).toBeInTheDocument();
      });
    });

    it('should render only selected columns headers', async () => {
      vi.mocked(useTodosByWeek).mockReturnValue({
        data: [
          createTestTodo({
            _id: '2025-01-13T10:00:00.000Z',
            title: 'Test',
            context: 'work',
            due: '2025-01-13T10:00:00.000Z',
          }),
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByWeek>);

      renderWithPouchDb(
        <TodoTable {...defaultProps} selectedColumns={['title', 'due', 'status']} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Due Date')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
        expect(screen.queryByText('Tags')).not.toBeInTheDocument();
      });
    });

    it('should show Actions column always', async () => {
      vi.mocked(useTodosByWeek).mockReturnValue({
        data: [
          createTestTodo({
            _id: '2025-01-13T10:00:00.000Z',
            title: 'Test',
            context: 'work',
            due: '2025-01-13T10:00:00.000Z',
          }),
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByWeek>);

      renderWithPouchDb(<TodoTable {...defaultProps} selectedColumns={['title']} />, {
        testDb: testDb.contextValue,
      });

      await waitFor(() => {
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
    });

    it('should render status column first when included', async () => {
      vi.mocked(useTodosByWeek).mockReturnValue({
        data: [
          createTestTodo({
            _id: '2025-01-13T10:00:00.000Z',
            title: 'Test',
            context: 'work',
            due: '2025-01-13T10:00:00.000Z',
          }),
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByWeek>);

      renderWithPouchDb(
        <TodoTable {...defaultProps} selectedColumns={['title', 'due', 'status']} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        const headers = screen.getAllByRole('columnheader');
        // First column should be status (empty header), then title, due, actions
        expect(headers[0].textContent).toBe('');
        expect(headers[1].textContent).toBe('Title');
        expect(headers[2].textContent).toBe('Due Date');
        expect(headers[3].textContent).toBe('Actions');
      });
    });
  });

  describe('User Interactions', () => {
    it('should open edit modal when edit button clicked', async () => {
      const user = userEvent.setup();
      const todos = [
        createTestTodo({
          _id: '2025-01-13T10:00:00.000Z',
          title: 'Test todo',
          context: 'work',
          due: '2025-01-13T10:00:00.000Z',
        }),
      ];

      vi.mocked(useTodosByWeek).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByWeek>);

      renderWithPouchDb(<TodoTable {...defaultProps} />, { testDb: testDb.contextValue });

      await waitFor(() => {
        expect(screen.getByText('Test todo')).toBeInTheDocument();
      });

      const editButton = screen.getByTitle('Edit');
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('todo-edit-flyout')).toBeInTheDocument();
      });
    });

    it('should render checkbox for todo completion status', async () => {
      const todos = [
        createTestTodo({
          _id: '2025-01-13T10:00:00.000Z',
          title: 'Test todo',
          context: 'work',
          due: '2025-01-13T10:00:00.000Z',
          completed: null,
        }),
      ];

      vi.mocked(useTodosByWeek).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByWeek>);

      renderWithPouchDb(<TodoTable {...defaultProps} />, { testDb: testDb.contextValue });

      await waitFor(() => {
        expect(screen.getByText('Test todo')).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('Filtering', () => {
    it('should filter todos by context', async () => {
      const todos = [
        createTestTodo({
          _id: '2025-01-13T10:00:00.000Z',
          title: 'Work todo',
          context: 'work',
          due: '2025-01-13T10:00:00.000Z',
        }),
        createTestTodo({
          _id: '2025-01-14T10:00:00.000Z',
          title: 'Home todo',
          context: 'home',
          due: '2025-01-14T10:00:00.000Z',
        }),
      ];

      vi.mocked(useTodosByWeek).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByWeek>);

      renderWithPouchDb(<TodoTable {...defaultProps} selectedContexts={['work']} />, {
        testDb: testDb.contextValue,
      });

      await waitFor(() => {
        expect(screen.getByText('Work todo')).toBeInTheDocument();
        expect(screen.queryByText('Home todo')).not.toBeInTheDocument();
      });
    });

    it('should filter todos by status (completed)', async () => {
      const todos = [
        createTestTodo({
          _id: '2025-01-13T10:00:00.000Z',
          title: 'Completed todo',
          context: 'work',
          due: '2025-01-13T10:00:00.000Z',
          completed: '2025-01-13T11:00:00.000Z',
        }),
        createTestTodo({
          _id: '2025-01-14T10:00:00.000Z',
          title: 'Incomplete todo',
          context: 'work',
          due: '2025-01-14T10:00:00.000Z',
          completed: null,
        }),
      ];

      vi.mocked(useTodosByWeek).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByWeek>);

      renderWithPouchDb(<TodoTable {...defaultProps} selectedStatus="completed" />, {
        testDb: testDb.contextValue,
      });

      await waitFor(() => {
        expect(screen.getByText('Completed todo')).toBeInTheDocument();
        expect(screen.queryByText('Incomplete todo')).not.toBeInTheDocument();
      });
    });

    it('should filter todos by tags', async () => {
      const todos = [
        createTestTodo({
          _id: '2025-01-13T10:00:00.000Z',
          title: 'Urgent todo',
          context: 'work',
          due: '2025-01-13T10:00:00.000Z',
          tags: ['urgent'],
        }),
        createTestTodo({
          _id: '2025-01-14T10:00:00.000Z',
          title: 'Normal todo',
          context: 'work',
          due: '2025-01-14T10:00:00.000Z',
          tags: ['normal'],
        }),
      ];

      vi.mocked(useTodosByWeek).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByWeek>);

      renderWithPouchDb(<TodoTable {...defaultProps} selectedTags={['urgent']} />, {
        testDb: testDb.contextValue,
      });

      await waitFor(() => {
        expect(screen.getByText('Urgent todo')).toBeInTheDocument();
        expect(screen.queryByText('Normal todo')).not.toBeInTheDocument();
      });
    });
  });
});
