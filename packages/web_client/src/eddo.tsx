import { useEffect, useState } from 'react';

import { AddTodo } from './components/add_todo';
import { Login } from './components/login';
import { PageWrapper } from './components/page_wrapper';
import { TodoBoard } from './components/todo_board';
import { DatabaseChangesProvider } from './hooks/use_database_changes';
import { useDatabaseHealth } from './hooks/use_database_health';
import { useSyncProduction } from './hooks/use_sync_production';
import { pouchDbContextValue } from './pouch_db';
import { PouchDbContext } from './pouch_db_types';

function ProductionSync() {
  useSyncProduction();
  return null;
}

function HealthMonitor() {
  const { startMonitoring } = useDatabaseHealth();

  useEffect(() => {
    startMonitoring();
  }, [startMonitoring]);

  return null;
}

export function Eddo() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { authenticate, isAuthenticated, isAuthenticating } =
    useSyncProduction();

  if (!isAuthenticated) {
    return <Login isAuthenticating={isAuthenticating} onLogin={authenticate} />;
  }

  return (
    <PouchDbContext.Provider value={pouchDbContextValue}>
      <DatabaseChangesProvider>
        <ProductionSync />
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
    </PouchDbContext.Provider>
  );
}
