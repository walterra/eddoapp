import { type FC, useCallback, useEffect, useState } from 'react';
import { HiOutlineClipboardList, HiOutlineLogout, HiOutlineUser } from 'react-icons/hi';

import { useDatabaseHealth } from '../hooks/use_database_health';
import { useProfile } from '../hooks/use_profile';
import { usePouchDb } from '../pouch_db';
import { AuditSidebar } from './audit_sidebar';
import { HealthIndicatorPopover } from './health_indicator_popover';

import { UserProfile } from './user_profile';

/** Hook for activity sidebar state with optimistic updates and persistence */
function useActivitySidebar() {
  const { profile, updatePreferences } = useProfile();
  const [isOpen, setIsOpen] = useState(false);

  // Sync local state when profile loads or changes
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

interface ProfileButtonProps {
  onClick: () => void;
}

const ProfileButton: FC<ProfileButtonProps> = ({ onClick }) => (
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

interface LogoutButtonProps {
  onClick: () => void;
}

const LogoutButton: FC<LogoutButtonProps> = ({ onClick }) => (
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

interface AuditToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

const AuditToggle: FC<AuditToggleProps> = ({ isOpen, onToggle }) => (
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

interface HeaderProps {
  isAuthenticated: boolean;
  databaseName: string;
  healthCheck: ReturnType<typeof useDatabaseHealth>['healthCheck'];
  onShowProfile: () => void;
  onLogout: () => void;
  showAuditSidebar: boolean;
  onToggleAuditSidebar: () => void;
}

const Header: FC<HeaderProps> = ({
  isAuthenticated,
  databaseName,
  healthCheck,
  onShowProfile,
  onLogout,
  showAuditSidebar,
  onToggleAuditSidebar,
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
          <AuditToggle isOpen={showAuditSidebar} onToggle={onToggleAuditSidebar} />
          <ProfileButton onClick={onShowProfile} />
          <LogoutButton onClick={onLogout} />
        </>
      )}
    </div>
  </div>
);

export const PageWrapper: FC<PageWrapperProps> = ({ children, logout, isAuthenticated }) => {
  const { healthCheck } = useDatabaseHealth();
  const { rawDb } = usePouchDb();
  const [showProfile, setShowProfile] = useState(false);
  const activitySidebar = useActivitySidebar();
  const databaseName = rawDb.name;

  if (showProfile) {
    return <UserProfile onClose={() => setShowProfile(false)} />;
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <main className="flex-1 overflow-auto px-4 pt-4 pb-3" role="main">
          <Header
            databaseName={databaseName}
            healthCheck={healthCheck}
            isAuthenticated={isAuthenticated}
            onLogout={logout}
            onShowProfile={() => setShowProfile(true)}
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
};
