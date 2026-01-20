/**
 * Page wrapper component - manages app views and sidebar state.
 */
import { type FC, useCallback, useEffect, useState } from 'react';

import { useDatabaseHealth } from '../hooks/use_database_health';
import { useProfile } from '../hooks/use_profile';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { usePouchDb } from '../pouch_db';
import { ChatView } from './chat_view';
import { TodosView } from './todos_view';
import { UserProfile } from './user_profile';

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
      <ChatView
        onBack={() => setCurrentView('todos')}
        onDock={chatNav.handleDockChat}
        onLogout={logout}
        onProfile={() => setCurrentView('profile')}
      />
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
