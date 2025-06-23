import { useEffect, useState } from 'react';

import { AddTodo } from './components/add_todo';
import { PageWrapper } from './components/page_wrapper';
import { TodoBoard } from './components/todo_board';
import { useDatabaseHealth } from './hooks/use_database_health';
import { useSyncDev } from './hooks/use_sync_dev';
import { PouchDbContext, pouchDbContextValue } from './pouch_db';

function DevSync() {
  useSyncDev();
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

  return (
    <PouchDbContext.Provider value={pouchDbContextValue}>
      <DevSync />
      <HealthMonitor />
      <PageWrapper>
        <AddTodo currentDate={currentDate} setCurrentDate={setCurrentDate} />
        <TodoBoard currentDate={currentDate} />
      </PageWrapper>
    </PouchDbContext.Provider>
  );
}
