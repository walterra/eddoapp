import { useState } from 'react';

import { AddTodo } from './components/add_todo';
import { PageWrapper } from './components/page_wrapper';
import { TodoBoard } from './components/todo_board';
import { pouchDb, PouchDbContext } from './pouch_db';

export function Eddo() {
  const [currentDate, setCurrentDate] = useState(new Date());

  return (
    <PouchDbContext.Provider value={pouchDb}>
      <PageWrapper>
        <AddTodo currentDate={currentDate} setCurrentDate={setCurrentDate} />
        <TodoBoard currentDate={currentDate} />
      </PageWrapper>
    </PouchDbContext.Provider>
  );
}
