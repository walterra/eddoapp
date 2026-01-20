/**
 * Page wrapper component - manages app views and sidebar state.
 */
import { lazy, Suspense, useCallback, useEffect, useState, type FC } from 'react';

import { useDatabaseHealth } from '../hooks/use_database_health';
import { useProfile } from '../hooks/use_profile';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { usePouchDb } from '../pouch_db';
import { TodosView } from './todos_view';
import { UserProfile } from './user_profile';

// Lazy load chat - it's heavy due to @assistant-ui dependencies
const ChatView = lazy(() => import('./chat_view').then((m) => ({ default: m.ChatView })));

/** Loading fallback for lazy views */
const ViewLoadingFallback = () => (
  <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
    <div className="text-center">
      <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-400" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
    </div>
  </div>
);

/** Hook for activity sidebar state with optimistic updates and persistence */
function useActivitySidebar() {
  const { profile, updatePreferences } = useProfile();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (profile?.preferences?.activitySidebarOpen !== undefined) {
      setIsOpen(profile.preferences.activitySidebarOpen);
    }
  }, [profile?.preferences?.activitySidebarOpen]);

  const toggle = useCallback(() => {
    const newState = !isOpen;
    setIsOpen(newState);
    void updatePreferences({ activitySidebarOpen: newState });
  }, [isOpen, updatePreferences]);

  const setOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      void updatePreferences({ activitySidebarOpen: open });
    },
    [updatePreferences],
  );

  return { isOpen, toggle, setOpen };
}

/** Hook for chat sidebar state with optimistic updates and persistence */
function useChatSidebar() {
  const { profile, updatePreferences } = useProfile();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.preferences?.chatSidebarOpen !== undefined) {
      setIsOpen(profile.preferences.chatSidebarOpen);
    }
    if (profile?.preferences?.chatSidebarSessionId !== undefined) {
      setSelectedSessionId(profile.preferences.chatSidebarSessionId ?? null);
    }
  }, [profile?.preferences?.chatSidebarOpen, profile?.preferences?.chatSidebarSessionId]);

  const setOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      void updatePreferences({ chatSidebarOpen: open });
    },
    [updatePreferences],
  );

  const setSession = useCallback(
    (sessionId: string | null) => {
      setSelectedSessionId(sessionId);
      void updatePreferences({ chatSidebarSessionId: sessionId ?? undefined });
    },
    [updatePreferences],
  );

  const open = useCallback(
    (sessionId?: string) => {
      setIsOpen(true);
      if (sessionId) setSelectedSessionId(sessionId);
      void updatePreferences({
        chatSidebarOpen: true,
        ...(sessionId ? { chatSidebarSessionId: sessionId } : {}),
      });
    },
    [updatePreferences],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    void updatePreferences({ chatSidebarOpen: false });
  }, [updatePreferences]);

  return { isOpen, selectedSessionId, setOpen, setSession, open, close };
}

/** Props for PageWrapper */
interface PageWrapperProps {
  children?: React.ReactNode;
  logout: () => void;
  isAuthenticated: boolean;
}

/** App view type */
export type AppView = 'todos' | 'profile' | 'chat';

/** Hook for chat navigation handlers */
function useChatNavigation(
  chatSidebar: ReturnType<typeof useChatSidebar>,
  setCurrentView: (view: AppView) => void,
) {
  const handleDockChat = useCallback(() => {
    chatSidebar.open();
    setCurrentView('todos');
  }, [chatSidebar, setCurrentView]);

  const handleExpandChat = useCallback(() => {
    chatSidebar.close();
    setCurrentView('chat');
  }, [chatSidebar, setCurrentView]);

  const handleChatClick = useCallback(() => {
    if (chatSidebar.isOpen) {
      chatSidebar.close();
    } else {
      chatSidebar.open();
    }
  }, [chatSidebar]);

  return { handleDockChat, handleExpandChat, handleChatClick };
}

/** Main page wrapper component */
export const PageWrapper: FC<PageWrapperProps> = ({ children, logout, isAuthenticated }) => {
  const { healthCheck } = useDatabaseHealth();
  const { rawDb } = usePouchDb();
  const [currentView, setCurrentView] = useState<AppView>('todos');
  const activitySidebar = useActivitySidebar();
  const chatSidebar = useChatSidebar();
  const { openTodoById } = useTodoFlyoutContext();
  const databaseName = rawDb.name;
  const chatNav = useChatNavigation(chatSidebar, setCurrentView);

  const handleSelectTodo = useCallback(
    (todoId: string) => {
      void openTodoById(todoId);
    },
    [openTodoById],
  );

  if (currentView === 'profile') {
    return <UserProfile onClose={() => setCurrentView('todos')} />;
  }

  if (currentView === 'chat') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <ChatView
          onBack={() => setCurrentView('todos')}
          onDock={chatNav.handleDockChat}
          onLogout={logout}
          onProfile={() => setCurrentView('profile')}
        />
      </Suspense>
    );
  }

  return (
    <TodosView
      activitySidebar={activitySidebar}
      chatSidebar={chatSidebar}
      databaseName={databaseName}
      healthCheck={healthCheck}
      isAuthenticated={isAuthenticated}
      logout={logout}
      onExpandChat={chatNav.handleExpandChat}
      onSelectTodo={handleSelectTodo}
      onShowChat={chatNav.handleChatClick}
      onShowProfile={() => setCurrentView('profile')}
    >
      {children}
    </TodosView>
  );
};
