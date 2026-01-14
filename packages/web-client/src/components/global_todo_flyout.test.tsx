import { type Todo } from '@eddo/core-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { type FC, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TodoFlyoutProvider, useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { PouchDbContext, type PouchDbContextType } from '../pouch_db_types';

import { GlobalTodoFlyout } from './global_todo_flyout';

// Mock TodoFlyout to simplify testing
vi.mock('./todo_flyout', () => ({
  TodoFlyout: ({ todo, show }: { todo: Todo; show: boolean }) =>
    show ? <div data-testid="todo-flyout">{todo.title}</div> : null,
}));

const mockPouchDbContext = {
  safeDb: {
    safeGet: vi.fn(),
    safePut: vi.fn(),
    safeRemove: vi.fn(),
    safeAllDocs: vi.fn(),
    safeBulkDocs: vi.fn(),
    safeQuery: vi.fn(),
    safeFind: vi.fn(),
  },
  changes: vi.fn(),
  sync: vi.fn(),
  healthMonitor: {} as PouchDbContextType['healthMonitor'],
  rawDb: { name: 'test-db' } as unknown as PouchDB.Database,
  attachmentsDb: { name: 'test-attachments-db' } as unknown as PouchDB.Database,
} as PouchDbContextType;

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

interface TestWrapperProps {
  children: ReactNode;
}

const TestWrapper: FC<TestWrapperProps> = ({ children }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <PouchDbContext.Provider value={mockPouchDbContext}>
        <TodoFlyoutProvider>{children}</TodoFlyoutProvider>
      </PouchDbContext.Provider>
    </QueryClientProvider>
  );
};

/** Test component to trigger openTodo */
const OpenTodoTrigger: FC<{ todo: Todo }> = ({ todo }) => {
  const { openTodo } = useTodoFlyoutContext();
  return (
    <button data-testid="open-trigger" onClick={() => openTodo(todo)}>
      Open Todo
    </button>
  );
};

describe('GlobalTodoFlyout', () => {
  const mockTodo: Todo = {
    _id: '2026-01-07T11:00:00.000Z',
    _rev: '1-abc',
    title: 'Test Todo',
    description: '',
    context: 'work',
    tags: [],
    due: '2026-01-08',
    completed: null,
    active: {},
    link: null,
    repeat: null,
    version: 'alpha3',
  };

  it('renders nothing when no todo is selected', () => {
    render(
      <TestWrapper>
        <GlobalTodoFlyout />
      </TestWrapper>,
    );

    expect(screen.queryByTestId('todo-flyout')).not.toBeInTheDocument();
  });

  it('renders flyout when todo is opened via context', () => {
    render(
      <TestWrapper>
        <OpenTodoTrigger todo={mockTodo} />
        <GlobalTodoFlyout />
      </TestWrapper>,
    );

    // Initially no flyout
    expect(screen.queryByTestId('todo-flyout')).not.toBeInTheDocument();

    // Click to open
    act(() => {
      screen.getByTestId('open-trigger').click();
    });

    // Flyout should appear with todo title
    expect(screen.getByTestId('todo-flyout')).toBeInTheDocument();
    expect(screen.getByText('Test Todo')).toBeInTheDocument();
  });
});
