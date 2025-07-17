import { useEffect, useState } from 'react';

import { AddTodo } from './components/add_todo';
import { Login } from './components/login';
import { PageWrapper } from './components/page_wrapper';
import { Register } from './components/register';
import { TodoBoard } from './components/todo_board';
import { useAuth } from './hooks/use_auth';
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
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { authenticate, register, isAuthenticated, isAuthenticating } =
    useAuth();

  if (!isAuthenticated) {
    if (authMode === 'register') {
      return (
        <Register
          isAuthenticating={isAuthenticating}
          onBackToLogin={() => setAuthMode('login')}
          onRegister={register}
        />
      );
    }
    return (
      <Login
        isAuthenticating={isAuthenticating}
        onGoToRegister={() => setAuthMode('register')}
        onLogin={authenticate}
      />
    );
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
