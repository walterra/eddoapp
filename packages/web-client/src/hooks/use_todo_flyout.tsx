/**
 * Context for managing which todo's flyout is open.
 * Lifting this state up prevents flyout from closing on todo updates.
 */
import { type Todo } from '@eddo/core-client';
import {
  type Dispatch,
  type FC,
  type ReactNode,
  type SetStateAction,
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
  openTodoInEdit: (todo: Todo) => void;
  openTodoById: (todoId: string) => Promise<void>;
  closeFlyout: () => void;
  updateTodo: (todo: Todo) => void;
  currentTodo: Todo | null;
  flyoutMode: 'view' | 'edit';
}

const TodoFlyoutContext = createContext<TodoFlyoutContextValue | null>(null);

interface TodoFlyoutProviderProps {
  children: ReactNode;
}

type FlyoutMode = 'view' | 'edit';

type RawDb = ReturnType<typeof usePouchDb>['rawDb'];

type SetState<T> = Dispatch<SetStateAction<T>>;

interface FlyoutSetters {
  setCurrentTodo: SetState<Todo | null>;
  setFlyoutMode: SetState<FlyoutMode>;
  setOpenTodoId: SetState<string | null>;
}

const useOpenTodoById = (rawDb: RawDb, setters: FlyoutSetters) =>
  useCallback(
    async (todoId: string) => {
      try {
        const todo = await rawDb.get(todoId);
        setters.setFlyoutMode('view');
        setters.setOpenTodoId(todo._id);
        setters.setCurrentTodo(todo as Todo);
      } catch (error) {
        console.error('Failed to open todo by ID:', error);
      }
    },
    [rawDb, setters],
  );

const useTodoFlyoutProviderState = (rawDb: RawDb): TodoFlyoutContextValue => {
  const [openTodoId, setOpenTodoId] = useState<string | null>(null);
  const [currentTodo, setCurrentTodo] = useState<Todo | null>(null);
  const [flyoutMode, setFlyoutMode] = useState<FlyoutMode>('view');

  const openTodo = useCallback((todo: Todo) => {
    setFlyoutMode('view');
    setOpenTodoId(todo._id);
    setCurrentTodo(todo);
  }, []);

  const openTodoInEdit = useCallback((todo: Todo) => {
    setFlyoutMode('edit');
    setOpenTodoId(todo._id);
    setCurrentTodo(todo);
  }, []);

  const openTodoById = useOpenTodoById(rawDb, {
    setCurrentTodo,
    setFlyoutMode,
    setOpenTodoId,
  });

  const closeFlyout = useCallback(() => {
    setOpenTodoId(null);
    setCurrentTodo(null);
    setFlyoutMode('view');
  }, []);

  const updateTodo = useCallback(
    (todo: Todo) => {
      if (todo._id === openTodoId) {
        setCurrentTodo(todo);
      }
    },
    [openTodoId],
  );

  return {
    openTodoId,
    openTodo,
    openTodoInEdit,
    openTodoById,
    closeFlyout,
    updateTodo,
    currentTodo,
    flyoutMode,
  };
};

export const TodoFlyoutProvider: FC<TodoFlyoutProviderProps> = ({ children }) => {
  const { rawDb } = usePouchDb();
  const value = useTodoFlyoutProviderState(rawDb);

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
  const { openTodoId, openTodo, closeFlyout, updateTodo, flyoutMode } = useTodoFlyoutContext();

  // Keep flyout's todo in sync when this todo updates
  useEffect(() => {
    if (openTodoId === todo._id) {
      updateTodo(todo);
    }
  }, [openTodoId, todo, updateTodo]);

  const isOpen = openTodoId === todo._id;
  const open = useCallback(() => openTodo(todo), [openTodo, todo]);

  return { isOpen, open, close: closeFlyout, mode: flyoutMode };
};
