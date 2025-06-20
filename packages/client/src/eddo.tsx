import { useState } from 'react';

import { AddTodo } from './components/add_todo';
import { PageWrapper } from './components/page_wrapper';
import { TodoBoard } from './components/todo_board';
import { useSyncDev } from './hooks/use_sync_dev';
import { PouchDbContext, pouchDb } from './pouch_db';

function DevSync() {
  useSyncDev();
  return null;
}

export function Eddo() {
  const [currentDate, setCurrentDate] = useState(new Date());

  return (
    <PouchDbContext.Provider value={pouchDb}>
      <DevSync />
      <PageWrapper>
        <AddTodo currentDate={currentDate} setCurrentDate={setCurrentDate} />
        <TodoBoard currentDate={currentDate} />
      </PageWrapper>
    </PouchDbContext.Provider>
  );
}
