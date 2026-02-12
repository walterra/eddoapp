import '@testing-library/jest-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../test-polyfill';
import { createTestPouchDb } from '../test-setup';
import { createTestTodo, renderWithPouchDb } from '../test-utils';
import { GlobalTodoFlyout } from './global_todo_flyout';
import { TodoTable } from './todo_table';

// Mock child components
vi.mock('./todo_flyout', () => ({
  TodoFlyout: ({ show, onClose }: { show: boolean; onClose: () => void }) =>
    show ? (
      <div data-testid="todo-flyout">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

// Mock useAuditLog to avoid AuthProvider dependency
vi.mock('../hooks/use_audit_log', () => ({
  useAuditLog: () => ({
    logAudit: vi.fn(),
  }),
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

vi.mock('./todo_graph', () => ({
  TodoGraph: ({ dependencyRootTodoId }: { dependencyRootTodoId?: string }) => (
    <div data-testid="dependency-graph">Dependency graph: {dependencyRootTodoId}</div>
  ),
}));

vi.mock('../database_setup', () => ({
  ensureDesignDocuments: vi.fn().mockResolvedValue(undefined),
}));

// Mock data hooks
vi.mock('../hooks/use_todos_by_date_range', () => ({
  useTodosByDateRange: vi.fn(),
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
import { useTodosByDateRange } from '../hooks/use_todos_by_date_range';

describe('TodoTable', () => {
  const defaultProps = {
    currentDate: new Date('2025-01-15T10:00:00.000Z'),
    selectedTags: [] as string[],
    selectedContexts: [] as string[],
    selectedStatus: 'all' as const,
    selectedTimeTracking: 'all' as const,
    selectedTimeRange: { type: 'current-week' as const },
    selectedColumns: ['title', 'due', 'tags', 'timeTracked', 'status'],
  };

  let testDb: ReturnType<typeof createTestPouchDb>;

  beforeEach(() => {
    testDb = createTestPouchDb();
    vi.clearAllMocks();

    // Default mock returns
    vi.mocked(useTodosByDateRange).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTodosByDateRange>);

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

      vi.mocked(useTodosByDateRange).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByDateRange>);

      renderWithPouchDb(<TodoTable {...defaultProps} />, { testDb: testDb.contextValue });

      await waitFor(() => {
        expect(screen.getByText('work')).toBeInTheDocument();
        expect(screen.getByText('home')).toBeInTheDocument();
        expect(screen.getByText('Work todo')).toBeInTheDocument();
        expect(screen.getByText('Home todo')).toBeInTheDocument();
      });
    });

    it('should render only selected columns headers', async () => {
      vi.mocked(useTodosByDateRange).mockReturnValue({
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
      } as unknown as ReturnType<typeof useTodosByDateRange>);

      renderWithPouchDb(
        <TodoTable {...defaultProps} selectedColumns={['title', 'due', 'status']} />,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Due Date')).toBeInTheDocument();
        // Status column renders a button with "Mark complete" title, not a checkbox
        expect(screen.getByTitle('Mark complete')).toBeInTheDocument();
        expect(screen.queryByText('Tags')).not.toBeInTheDocument();
      });
    });

    it('should show Actions column always', async () => {
      vi.mocked(useTodosByDateRange).mockReturnValue({
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
      } as unknown as ReturnType<typeof useTodosByDateRange>);

      renderWithPouchDb(<TodoTable {...defaultProps} selectedColumns={['title']} />, {
        testDb: testDb.contextValue,
      });

      await waitFor(() => {
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
    });

    it('should render status column first when included', async () => {
      vi.mocked(useTodosByDateRange).mockReturnValue({
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
      } as unknown as ReturnType<typeof useTodosByDateRange>);

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

      vi.mocked(useTodosByDateRange).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByDateRange>);

      renderWithPouchDb(
        <>
          <TodoTable {...defaultProps} />
          <GlobalTodoFlyout />
        </>,
        { testDb: testDb.contextValue },
      );

      await waitFor(() => {
        expect(screen.getByText('Test todo')).toBeInTheDocument();
      });

      const titleButton = screen.getByRole('button', { name: 'Test todo' });
      await user.click(titleButton);

      await waitFor(() => {
        expect(screen.getByTestId('todo-flyout')).toBeInTheDocument();
      });
    });

    it('should render completion toggle button for todo status', async () => {
      const todos = [
        createTestTodo({
          _id: '2025-01-13T10:00:00.000Z',
          title: 'Test todo',
          context: 'work',
          due: '2025-01-13T10:00:00.000Z',
          completed: null,
        }),
      ];

      vi.mocked(useTodosByDateRange).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByDateRange>);

      renderWithPouchDb(<TodoTable {...defaultProps} />, { testDb: testDb.contextValue });

      await waitFor(() => {
        expect(screen.getByText('Test todo')).toBeInTheDocument();
      });

      // Status column renders a button with "Mark complete" title for incomplete todos
      const toggleButton = screen.getByTitle('Mark complete');
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton.tagName).toBe('BUTTON');
    });

    it('should replace table with dependency graph from row actions', async () => {
      const user = userEvent.setup();
      const todos = [
        createTestTodo({
          _id: 'todo-1',
          title: 'Dependency root todo',
          context: 'work',
          due: '2025-01-13T10:00:00.000Z',
        }),
      ];

      vi.mocked(useTodosByDateRange).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByDateRange>);

      renderWithPouchDb(<TodoTable {...defaultProps} />, { testDb: testDb.contextValue });

      await waitFor(() => {
        expect(screen.getByText('Dependency root todo')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Row actions'));
      await user.click(await screen.findByRole('button', { name: 'Show dependencies' }));

      await waitFor(() => {
        expect(screen.getByTestId('dependency-graph')).toBeInTheDocument();
        expect(screen.getByText('Dependency graph: todo-1')).toBeInTheDocument();
      });
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

      vi.mocked(useTodosByDateRange).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByDateRange>);

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

      vi.mocked(useTodosByDateRange).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByDateRange>);

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

      vi.mocked(useTodosByDateRange).mockReturnValue({
        data: todos,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTodosByDateRange>);

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
