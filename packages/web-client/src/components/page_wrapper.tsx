import { type FC, useCallback, useEffect, useState } from 'react';
import {
  HiOutlineChat,
  HiOutlineClipboardList,
  HiOutlineLogout,
  HiOutlineUser,
} from 'react-icons/hi';

import { useDatabaseHealth } from '../hooks/use_database_health';
import { useProfile } from '../hooks/use_profile';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { usePouchDb } from '../pouch_db';
import { AuditSidebar } from './audit_sidebar';
import { ChatPage } from './chat';
import { HealthIndicatorPopover } from './health_indicator_popover';
import { SearchPopover } from './search_popover';
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

interface PageWrapperProps {
  children?: React.ReactNode;
  logout: () => void;
  isAuthenticated: boolean;
}

const EddoLogo: FC = () => (
  <pre aria-label="Eddo logo" className="m-0 p-0 font-mono text-sm leading-tight" role="img">
    {`   ┓ ┓
┏┓┏┫┏┫┏┓
┗ ┗┻┗┻┗┛`}
  </pre>
);

const ProfileButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    aria-label="Profile"
    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
    onClick={onClick}
    title="Profile"
    type="button"
  >
    <HiOutlineUser className="h-5 w-5" />
  </button>
);

const LogoutButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    aria-label="Logout"
    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
    onClick={onClick}
    title="Logout"
    type="button"
  >
    <HiOutlineLogout className="h-5 w-5" />
  </button>
);

const AuditToggle: FC<{ isOpen: boolean; onToggle: () => void }> = ({ isOpen, onToggle }) => (
  <button
    aria-label={isOpen ? 'Hide activity log' : 'Show activity log'}
    className={`flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-400 ${isOpen ? 'bg-neutral-200 dark:bg-neutral-700' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
    onClick={onToggle}
    title={isOpen ? 'Hide activity log' : 'Show activity log'}
    type="button"
  >
    <HiOutlineClipboardList className="h-5 w-5" />
  </button>
);

const ChatButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    aria-label="AI Chat"
    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
    onClick={onClick}
    title="AI Chat"
    type="button"
  >
    <HiOutlineChat className="h-5 w-5" />
  </button>
);

interface HeaderProps {
  isAuthenticated: boolean;
  databaseName: string;
  healthCheck: ReturnType<typeof useDatabaseHealth>['healthCheck'];
  onShowChat: () => void;
  onShowProfile: () => void;
  onLogout: () => void;
  showAuditSidebar: boolean;
  onToggleAuditSidebar: () => void;
  onSelectTodo: (todoId: string) => void;
}

const Header: FC<HeaderProps> = ({
  isAuthenticated,
  databaseName,
  healthCheck,
  onShowChat,
  onShowProfile,
  onLogout,
  showAuditSidebar,
  onToggleAuditSidebar,
  onSelectTodo,
}) => (
  <div className="mb-2 flex items-center justify-between">
    <div>
      <h1 className="sr-only">Eddo</h1>
      <EddoLogo />
    </div>
    <div className="flex items-center space-x-1">
      {isAuthenticated && (
        <>
          <SearchPopover onSelectTodo={onSelectTodo} />
          <HealthIndicatorPopover databaseName={databaseName} healthCheck={healthCheck} />
          <ChatButton onClick={onShowChat} />
          <AuditToggle isOpen={showAuditSidebar} onToggle={onToggleAuditSidebar} />
          <ProfileButton onClick={onShowProfile} />
          <LogoutButton onClick={onLogout} />
        </>
      )}
    </div>
  </div>
);

/** App view type */
export type AppView = 'todos' | 'profile' | 'chat';

/** Chat view header with navigation */
const ChatViewHeader: FC<{
  onBack: () => void;
  onProfile: () => void;
  onLogout: () => void;
}> = ({ onBack, onProfile, onLogout }) => (
  <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-700">
    <button
      className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      onClick={onBack}
      type="button"
    >
      ← Back to Todos
    </button>
    <div className="flex items-center space-x-1">
      <ProfileButton onClick={onProfile} />
      <LogoutButton onClick={onLogout} />
    </div>
  </div>
);

/** Chat view wrapper */
const ChatView: FC<{
  onBack: () => void;
  onProfile: () => void;
  onLogout: () => void;
}> = ({ onBack, onProfile, onLogout }) => (
  <div className="flex h-screen w-full flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-900">
    <ChatViewHeader onBack={onBack} onLogout={onLogout} onProfile={onProfile} />
    <div className="min-h-0 flex-1">
      <ChatPage />
    </div>
  </div>
);

/** Todos view wrapper */
const TodosView: FC<{
  children: React.ReactNode;
  isAuthenticated: boolean;
  logout: () => void;
  onShowChat: () => void;
  onShowProfile: () => void;
  onSelectTodo: (todoId: string) => void;
  activitySidebar: ReturnType<typeof useActivitySidebar>;
  databaseName: string;
  healthCheck: ReturnType<typeof useDatabaseHealth>['healthCheck'];
}> = ({
  children,
  isAuthenticated,
  logout,
  onShowChat,
  onShowProfile,
  onSelectTodo,
  activitySidebar,
  databaseName,
  healthCheck,
}) => (
  <div className="flex h-screen w-full flex-col overflow-hidden">
    <div className="flex min-h-0 flex-1">
      <main className="flex-1 overflow-auto px-4 pt-4 pb-3" role="main">
        <Header
          databaseName={databaseName}
          healthCheck={healthCheck}
          isAuthenticated={isAuthenticated}
          onLogout={logout}
          onSelectTodo={onSelectTodo}
          onShowChat={onShowChat}
          onShowProfile={onShowProfile}
          onToggleAuditSidebar={activitySidebar.toggle}
          showAuditSidebar={activitySidebar.isOpen}
        />
        {children}
        <footer className="mt-8 pb-3">
          <a href="https://eddoapp.com" rel="noreferrer" target="_BLANK">
            eddoapp.com
          </a>
        </footer>
      </main>
      {isAuthenticated && activitySidebar.isOpen && (
        <AuditSidebar isOpen={activitySidebar.isOpen} onToggle={activitySidebar.setOpen} />
      )}
    </div>
  </div>
);

export const PageWrapper: FC<PageWrapperProps> = ({ children, logout, isAuthenticated }) => {
  const { healthCheck } = useDatabaseHealth();
  const { rawDb } = usePouchDb();
  const [currentView, setCurrentView] = useState<AppView>('todos');
  const activitySidebar = useActivitySidebar();
  const { openTodoById } = useTodoFlyoutContext();
  const databaseName = rawDb.name;

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
        onLogout={logout}
        onProfile={() => setCurrentView('profile')}
      />
    );
  }

  return (
    <TodosView
      activitySidebar={activitySidebar}
      databaseName={databaseName}
      healthCheck={healthCheck}
      isAuthenticated={isAuthenticated}
      logout={logout}
      onSelectTodo={handleSelectTodo}
      onShowChat={() => setCurrentView('chat')}
      onShowProfile={() => setCurrentView('profile')}
    >
      {children}
    </TodosView>
  );
};
