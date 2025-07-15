import { getEffectiveDbName, validateEnv } from '@eddo/core';
import { type FC } from 'react';

import { useDatabaseHealth } from '../hooks/use_database_health';
import { DatabaseHealthIndicator } from './database_health_indicator';

interface PageWrapperProps {
  children?: React.ReactNode;
}

export const PageWrapper: FC<PageWrapperProps> = ({ children }) => {
  const { healthCheck } = useDatabaseHealth();

  // Get the database name for display
  const env = validateEnv(import.meta.env);
  const databaseName = getEffectiveDbName(env);

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
            <DatabaseHealthIndicator
              databaseName={databaseName}
              healthCheck={healthCheck}
              showDetails={true}
            />
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
