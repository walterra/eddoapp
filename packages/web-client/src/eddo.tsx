import { useEffect, useState } from 'react';

import { AddTodo } from './components/add_todo';
import { Login } from './components/login';
import { PageWrapper } from './components/page_wrapper';
import { TodoBoard } from './components/todo_board';
import { useCouchDbSync } from './hooks/use_couchdb_sync';
import { DatabaseChangesProvider } from './hooks/use_database_changes';
import { useDatabaseHealth } from './hooks/use_database_health';
import { pouchDbContextValue } from './pouch_db';
import { PouchDbContext } from './pouch_db_types';

function CouchdbSyncProvider() {
  useCouchDbSync();
  return null;
}

function HealthMonitor() {
  const { startMonitoring } = useDatabaseHealth();

  useEffect(() => {
    startMonitoring();
  }, [startMonitoring]);

  return null;
}

function AuthenticatedApp() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { authenticate, isAuthenticated, isAuthenticating } = useCouchDbSync();

  if (!isAuthenticated) {
    return <Login isAuthenticating={isAuthenticating} onLogin={authenticate} />;
  }

  return (
    <DatabaseChangesProvider>
      <CouchdbSyncProvider />
      <HealthMonitor />
      <PageWrapper>
        <AddTodo
          currentDate={currentDate}
          selectedTags={selectedTags}
          setCurrentDate={setCurrentDate}
          setSelectedTags={setSelectedTags}
        />
        <TodoBoard currentDate={currentDate} selectedTags={selectedTags} />
      </PageWrapper>
    </DatabaseChangesProvider>
  );
}

export function Eddo() {
  return (
    <PouchDbContext.Provider value={pouchDbContextValue}>
      <AuthenticatedApp />
    </PouchDbContext.Provider>
  );
}
