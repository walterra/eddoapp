/**
 * Todos view wrapper component with header and sidebars.
 */
import type { FC, ReactNode } from 'react';
import {
  HiOutlineChat,
  HiOutlineClipboardList,
  HiOutlineLogout,
  HiOutlineUser,
} from 'react-icons/hi';

import type { useDatabaseHealth } from '../hooks/use_database_health';
import { AuditSidebar } from './audit_sidebar';
import { ChatSidebar } from './chat';
import { HealthIndicatorPopover } from './health_indicator_popover';

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
  children: ReactNode;
}> = ({ onClick, label, title, isActive = false, children }) => (
  <button
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
  showChatSidebar,
}) => (
  <div className="mb-2 flex items-center justify-between">
    <div>
      <h1 className="sr-only">Eddo</h1>
      <EddoLogo />
    </div>
    <div className="flex items-center space-x-1">
      {isAuthenticated && (
        <>
          <HealthIndicatorPopover databaseName={databaseName} healthCheck={healthCheck} />
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
          <IconButton label="Profile" onClick={onShowProfile} title="Profile">
            <HiOutlineUser className="h-5 w-5" />
          </IconButton>
          <IconButton label="Logout" onClick={onLogout} title="Logout">
            <HiOutlineLogout className="h-5 w-5" />
          </IconButton>
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
  chatSidebar: ChatSidebarState;
  onExpandChat: () => void;
  databaseName: string;
  healthCheck: ReturnType<typeof useDatabaseHealth>['healthCheck'];
}

/** Todos view wrapper */
export const TodosView: FC<TodosViewProps> = ({
  children,
  isAuthenticated,
  logout,
  onShowChat,
  onShowProfile,
  activitySidebar,
  chatSidebar,
  onExpandChat,
  databaseName,
  healthCheck,
}) => (
  <div className="flex h-screen w-full flex-col overflow-hidden">
    <div className="flex min-h-0 flex-1">
      <main className="min-w-0 flex-1 overflow-auto px-4 pt-4 pb-3" role="main">
        <Header
          databaseName={databaseName}
          healthCheck={healthCheck}
          isAuthenticated={isAuthenticated}
          onLogout={logout}
          onShowChat={onShowChat}
          onShowProfile={onShowProfile}
          onToggleAuditSidebar={activitySidebar.toggle}
          showAuditSidebar={activitySidebar.isOpen}
          showChatSidebar={chatSidebar.isOpen}
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
      {isAuthenticated && (
        <ChatSidebar
          isOpen={chatSidebar.isOpen}
          onClose={chatSidebar.close}
          onExpand={onExpandChat}
          onSelectSession={chatSidebar.setSession}
          selectedSessionId={chatSidebar.selectedSessionId}
        />
      )}
    </div>
  </div>
);
