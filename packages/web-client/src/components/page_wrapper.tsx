import { getClientDbName, validateClientEnv } from '@eddo/core-client';
import { Button } from 'flowbite-react';
import { type FC, useState } from 'react';

import { useDatabaseHealth } from '../hooks/use_database_health';
import { DatabaseHealthIndicator } from './database_health_indicator';
import { UserProfile } from './user_profile';

interface PageWrapperProps {
  children?: React.ReactNode;
  logout: () => void;
  isAuthenticated: boolean;
}

export const PageWrapper: FC<PageWrapperProps> = ({
  children,
  logout,
  isAuthenticated,
}) => {
  const { healthCheck } = useDatabaseHealth();
  const [showProfile, setShowProfile] = useState(false);

  // Get the database name for display
  const env = validateClientEnv(import.meta.env);
  const databaseName = getClientDbName(env);

  // Show profile if requested
  if (showProfile) {
    return <UserProfile onClose={() => setShowProfile(false)} />;
  }

  return (
    <>
      <div className="flex w-full flex-grow flex-col overflow-hidden sm:flex-row">
        {/* <div className="md:1/4 w-full flex-shrink flex-grow-0 p-4 sm:w-1/3">
            <div className="sticky top-0 w-full p-4">
              <ul className="flex content-center justify-between overflow-hidden sm:flex-col">
                Navigation
              </ul>
            </div>
          </div> */}
        <main className="h-full w-full flex-grow overflow-auto p-3" role="main">
          <div className="mb-4 flex items-center justify-between">
            <div className="prose">
              <h1>Eddo</h1>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated && (
                <div className="flex space-x-2">
                  <Button
                    color="gray"
                    onClick={() => setShowProfile(true)}
                    size="sm"
                  >
                    Profile
                  </Button>
                  <Button color="gray" onClick={logout} size="sm">
                    Logout
                  </Button>
                </div>
              )}
              <DatabaseHealthIndicator
                databaseName={databaseName}
                healthCheck={healthCheck}
                showDetails={true}
              />
            </div>
          </div>
          {children}
        </main>
      </div>
      <footer className="mx-3 mt-auto">
        <a href="https://eddoapp.com" rel="noreferrer" target="_BLANK">
          eddoapp.com
        </a>
      </footer>
    </>
  );
};
