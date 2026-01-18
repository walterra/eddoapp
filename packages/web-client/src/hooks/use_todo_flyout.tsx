/**
 * Context for managing which todo's flyout is open.
 * Lifting this state up prevents flyout from closing on todo updates.
 */
import { type Todo } from '@eddo/core-client';
import {
  type FC,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { usePouchDb } from '../pouch_db';

interface TodoFlyoutContextValue {
  openTodoId: string | null;
  openTodo: (todo: Todo) => void;
  openTodoById: (todoId: string) => Promise<void>;
  closeFlyout: () => void;
  updateTodo: (todo: Todo) => void;
  currentTodo: Todo | null;
}

const TodoFlyoutContext = createContext<TodoFlyoutContextValue | null>(null);

interface TodoFlyoutProviderProps {
  children: ReactNode;
}

export const TodoFlyoutProvider: FC<TodoFlyoutProviderProps> = ({ children }) => {
  const [openTodoId, setOpenTodoId] = useState<string | null>(null);
  const [currentTodo, setCurrentTodo] = useState<Todo | null>(null);
  const { rawDb } = usePouchDb();

  const openTodo = useCallback((todo: Todo) => {
    setOpenTodoId(todo._id);
    setCurrentTodo(todo);
  }, []);

  const openTodoById = useCallback(
    async (todoId: string) => {
      try {
        const todo = await rawDb.get(todoId);
        setOpenTodoId(todo._id);
        setCurrentTodo(todo as Todo);
      } catch (error) {
        console.error('Failed to open todo by ID:', error);
      }
    },
    [rawDb],
  );

  const closeFlyout = useCallback(() => {
    setOpenTodoId(null);
    setCurrentTodo(null);
  }, []);

  const updateTodo = useCallback(
    (todo: Todo) => {
      if (todo._id === openTodoId) {
        setCurrentTodo(todo);
      }
    },
    [openTodoId],
  );

  const value = { openTodoId, openTodo, openTodoById, closeFlyout, updateTodo, currentTodo };

  return <TodoFlyoutContext.Provider value={value}>{children}</TodoFlyoutContext.Provider>;
};

export const useTodoFlyoutContext = (): TodoFlyoutContextValue => {
  const context = useContext(TodoFlyoutContext);
  if (!context) {
    throw new Error('useTodoFlyoutContext must be used within TodoFlyoutProvider');
  }
  return context;
};

/**
 * Hook for individual todo items to control flyout.
 * Also keeps the flyout's todo in sync when the underlying todo updates.
 * @param todo - The todo this component represents
 */
export const useTodoFlyout = (todo: Todo) => {
  const { openTodoId, openTodo, closeFlyout, updateTodo } = useTodoFlyoutContext();

  // Keep flyout's todo in sync when this todo updates
  useEffect(() => {
    if (openTodoId === todo._id) {
      updateTodo(todo);
    }
  }, [openTodoId, todo, updateTodo]);

  const isOpen = openTodoId === todo._id;
  const open = useCallback(() => openTodo(todo), [openTodo, todo]);

  return { isOpen, open, close: closeFlyout };
};
