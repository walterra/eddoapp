/**
 * Todos view wrapper component with header and sidebars.
 */
import { lazy, Suspense, type FC, type ReactNode } from 'react';
import {
  HiOutlineChat,
  HiOutlineClipboardList,
  HiOutlineLogout,
  HiOutlineSparkles,
  HiOutlineUser,
} from 'react-icons/hi';

import type { AssistantSidebarState } from '../hooks/use_assistant_sidebar';
import type { useDatabaseHealth } from '../hooks/use_database_health';
import { AuditSidebar } from './audit_sidebar';
import { HealthIndicatorPopover } from './health_indicator_popover';
import { SearchPopover } from './search_popover';

// Lazy load ChatSidebar - it's heavy due to @assistant-ui dependencies
const ChatSidebar = lazy(() => import('./chat').then((m) => ({ default: m.ChatSidebar })));
const AssistantSidebar = lazy(() =>
  import('./assistant/assistant_sidebar').then((m) => ({ default: m.AssistantSidebar })),
);

/** Activity sidebar state interface */
export interface ActivitySidebarState {
  isOpen: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

/** Chat sidebar state interface */
export interface ChatSidebarState {
  isOpen: boolean;
  selectedSessionId: string | null;
  setOpen: (open: boolean) => void;
  setSession: (sessionId: string | null) => void;
  open: (sessionId?: string) => void;
  close: () => void;
}

const EddoLogo: FC = () => (
  <pre aria-label="Eddo logo" className="m-0 p-0 font-mono text-sm leading-tight" role="img">
    {`   ┓ ┓
┏┓┏┫┏┫┏┓
┗ ┗┻┗┻┗┛`}
  </pre>
);

const IconButton: FC<{
  onClick: () => void;
  label: string;
  title: string;
  isActive?: boolean;
  controls?: string;
  expanded?: boolean;
  children: ReactNode;
}> = ({ onClick, label, title, isActive = false, controls, expanded, children }) => (
  <button
    aria-controls={controls}
    aria-expanded={expanded}
    aria-label={label}
    className={`flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-400 ${
      isActive
        ? 'bg-neutral-200 dark:bg-neutral-700'
        : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
    }`}
    onClick={onClick}
    title={title}
    type="button"
  >
    {children}
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
  showChatSidebar: boolean;
  assistantSidebar: AssistantSidebarState;
  onSelectTodo: (todoId: string) => void;
}

const AssistantToggle: FC<AssistantSidebarState> = ({ isOpen, toggle }) => (
  <IconButton
    controls="shared-assistant-sidebar"
    expanded={isOpen}
    isActive={isOpen}
    label={isOpen ? 'Hide assistant' : 'Show assistant'}
    onClick={toggle}
    title="Assistant — shared with Telegram"
  >
    <HiOutlineSparkles aria-hidden="true" className="h-5 w-5" />
  </IconButton>
);

type AccountActionsProps = Pick<HeaderProps, 'onLogout' | 'onShowProfile'>;
const AccountActions: FC<AccountActionsProps> = ({ onLogout, onShowProfile }) => (
  <>
    <IconButton label="Profile" onClick={onShowProfile} title="Profile">
      <HiOutlineUser className="h-5 w-5" />
    </IconButton>
    <IconButton label="Logout" onClick={onLogout} title="Logout">
      <HiOutlineLogout className="h-5 w-5" />
    </IconButton>
  </>
);

/** Header with navigation buttons */
const Header: FC<HeaderProps> = ({
  isAuthenticated,
  databaseName,
  healthCheck,
  onShowChat,
  onShowProfile,
  onLogout,
  showAuditSidebar,
  onToggleAuditSidebar,
  showChatSidebar,
  assistantSidebar,
  onSelectTodo,
}) => (
  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
    <div>
      <h1 className="sr-only">Eddo</h1>
      <EddoLogo />
    </div>
    <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1">
      {isAuthenticated && (
        <>
          <SearchPopover onSelectTodo={onSelectTodo} />
          <HealthIndicatorPopover databaseName={databaseName} healthCheck={healthCheck} />
          <AssistantToggle {...assistantSidebar} />
          <IconButton
            isActive={showChatSidebar}
            label={showChatSidebar ? 'Hide chat sidebar' : 'Show chat'}
            onClick={onShowChat}
            title={showChatSidebar ? 'Hide chat sidebar' : 'Show chat'}
          >
            <HiOutlineChat className="h-5 w-5" />
          </IconButton>
          <IconButton
            isActive={showAuditSidebar}
            label={showAuditSidebar ? 'Hide activity log' : 'Show activity log'}
            onClick={onToggleAuditSidebar}
            title={showAuditSidebar ? 'Hide activity log' : 'Show activity log'}
          >
            <HiOutlineClipboardList className="h-5 w-5" />
          </IconButton>
          <AccountActions onLogout={onLogout} onShowProfile={onShowProfile} />
        </>
      )}
    </div>
  </div>
);

/** Props for TodosView */
export interface TodosViewProps {
  children: ReactNode;
  isAuthenticated: boolean;
  logout: () => void;
  onShowChat: () => void;
  onShowProfile: () => void;
  activitySidebar: ActivitySidebarState;
  assistantSidebar: AssistantSidebarState;
  chatSidebar: ChatSidebarState;
  onExpandChat: () => void;
  databaseName: string;
  healthCheck: ReturnType<typeof useDatabaseHealth>['healthCheck'];
  onSelectTodo: (todoId: string) => void;
}

/** Main content area with header and children */
const MainContent: FC<{
  children: ReactNode;
  headerProps: HeaderProps;
}> = ({ children, headerProps }) => (
  <main className="min-w-0 flex-1 overflow-auto px-4 pt-4 pb-3" role="main">
    <Header {...headerProps} />
    {children}
    <footer className="mt-8 pb-3">
      <a href="https://eddoapp.com" rel="noreferrer" target="_BLANK">
        eddoapp.com
      </a>
    </footer>
  </main>
);

type TodoSidebarsProps = Pick<
  TodosViewProps,
  'activitySidebar' | 'assistantSidebar' | 'chatSidebar' | 'isAuthenticated' | 'onExpandChat'
>;
const TodoSidebars: FC<TodoSidebarsProps> = ({
  activitySidebar,
  assistantSidebar,
  chatSidebar,
  isAuthenticated,
  onExpandChat,
}) => (
  <>
    {isAuthenticated && activitySidebar.isOpen && (
      <AuditSidebar isOpen={activitySidebar.isOpen} onToggle={activitySidebar.setOpen} />
    )}
    {isAuthenticated && assistantSidebar.isOpen && (
      <Suspense fallback={null}>
        <AssistantSidebar onClose={assistantSidebar.close} />
      </Suspense>
    )}
    {isAuthenticated && (
      <Suspense fallback={null}>
        <ChatSidebar
          isOpen={chatSidebar.isOpen}
          onClose={chatSidebar.close}
          onExpand={onExpandChat}
          onSelectSession={chatSidebar.setSession}
          selectedSessionId={chatSidebar.selectedSessionId}
        />
      </Suspense>
    )}
  </>
);

/** Todos view wrapper */
export const TodosView: FC<TodosViewProps> = (props) => {
  const {
    children,
    isAuthenticated,
    logout,
    onShowChat,
    onShowProfile,
    activitySidebar,
    assistantSidebar,
    chatSidebar,
    onExpandChat,
    databaseName,
    healthCheck,
    onSelectTodo,
  } = props;

  const headerProps: HeaderProps = {
    isAuthenticated,
    databaseName,
    healthCheck,
    onShowChat,
    onShowProfile,
    onLogout: logout,
    showAuditSidebar: activitySidebar.isOpen,
    onToggleAuditSidebar: activitySidebar.toggle,
    showChatSidebar: chatSidebar.isOpen,
    assistantSidebar,
    onSelectTodo,
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <MainContent headerProps={headerProps}>{children}</MainContent>
        <TodoSidebars
          activitySidebar={activitySidebar}
          assistantSidebar={assistantSidebar}
          chatSidebar={chatSidebar}
          isAuthenticated={isAuthenticated}
          onExpandChat={onExpandChat}
        />
      </div>
    </div>
  );
};
