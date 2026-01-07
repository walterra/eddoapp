import { Button } from 'flowbite-react';
import { type FC, useState } from 'react';

import { useDatabaseHealth } from '../hooks/use_database_health';
import { usePouchDb } from '../pouch_db';
import { AuditSidebar } from './audit_sidebar';
import { DatabaseHealthIndicator } from './database_health_indicator';

import { UserProfile } from './user_profile';

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

interface AuthButtonsProps {
  onShowProfile: () => void;
  onLogout: () => void;
}

const AuthButtons: FC<AuthButtonsProps> = ({ onShowProfile, onLogout }) => (
  <div className="flex space-x-2">
    <Button color="gray" onClick={onShowProfile} size="sm">
      Profile
    </Button>
    <Button color="gray" onClick={onLogout} size="sm">
      Logout
    </Button>
  </div>
);

interface AuditToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

const AuditToggle: FC<AuditToggleProps> = ({ isOpen, onToggle }) => (
  <button
    className={`rounded p-1 text-lg ${isOpen ? 'bg-neutral-200 dark:bg-neutral-700' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
    onClick={onToggle}
    title={isOpen ? 'Hide activity log' : 'Show activity log'}
  >
    📋
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
    <div className="flex items-center space-x-4">
      {isAuthenticated && (
        <>
          <AuditToggle isOpen={showAuditSidebar} onToggle={onToggleAuditSidebar} />
          <AuthButtons onLogout={onLogout} onShowProfile={onShowProfile} />
        </>
      )}
      <DatabaseHealthIndicator
        databaseName={databaseName}
        healthCheck={healthCheck}
        showDetails={true}
      />
    </div>
  </div>
);

export const PageWrapper: FC<PageWrapperProps> = ({ children, logout, isAuthenticated }) => {
  const { healthCheck } = useDatabaseHealth();
  const { rawDb } = usePouchDb();
  const [showProfile, setShowProfile] = useState(false);
  const [showAuditSidebar, setShowAuditSidebar] = useState(false);
  const databaseName = rawDb.name;

  if (showProfile) {
    return <UserProfile onClose={() => setShowProfile(false)} />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="flex w-full flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto px-4 pt-4 pb-3" role="main">
          <Header
            databaseName={databaseName}
            healthCheck={healthCheck}
            isAuthenticated={isAuthenticated}
            onLogout={logout}
            onShowProfile={() => setShowProfile(true)}
            onToggleAuditSidebar={() => setShowAuditSidebar(!showAuditSidebar)}
            showAuditSidebar={showAuditSidebar}
          />
          {children}
        </main>
        {isAuthenticated && showAuditSidebar && (
          <AuditSidebar
            isOpen={showAuditSidebar}
            onToggle={(isOpen) => setShowAuditSidebar(isOpen)}
          />
        )}
      </div>
      <footer className="mx-3 mt-auto">
        <a href="https://eddoapp.com" rel="noreferrer" target="_BLANK">
          eddoapp.com
        </a>
      </footer>
    </div>
  );
};
