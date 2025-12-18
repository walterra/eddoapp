import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useMemo, useState } from 'react';

import { AddTodo } from './components/add_todo';
import { Login } from './components/login';
import { PageWrapper } from './components/page_wrapper';
import { Register } from './components/register';
import type { CompletionStatus } from './components/status_filter';
import type { TimeRange } from './components/time_range_filter';
import { TodoBoard } from './components/todo_board';
import { TodoFilters } from './components/todo_filters';
import { createQueryClient } from './config/query_client';
import { useAuth } from './hooks/use_auth';
import { useCouchDbSync } from './hooks/use_couchdb_sync';
import { DatabaseChangesProvider } from './hooks/use_database_changes';
import { useDatabaseHealth } from './hooks/use_database_health';
import { createUserPouchDbContext } from './pouch_db';
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

interface AuthenticatedAppProps {
  authenticate: (username: string, password: string) => Promise<boolean>;
  register: (
    username: string,
    email: string,
    password: string,
    telegramId?: number,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
}

function AuthenticatedApp({
  authenticate,
  register,
  logout,
  isAuthenticated,
  isAuthenticating,
}: AuthenticatedAppProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<CompletionStatus>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>({
    type: 'current-week',
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Reset authMode to 'login' when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setAuthMode('login');
    }
  }, [isAuthenticated]);

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
      <PageWrapper isAuthenticated={isAuthenticated} logout={logout}>
        <AddTodo />
        <TodoFilters
          currentDate={currentDate}
          selectedContexts={selectedContexts}
          selectedStatus={selectedStatus}
          selectedTags={selectedTags}
          selectedTimeRange={selectedTimeRange}
          setCurrentDate={setCurrentDate}
          setSelectedContexts={setSelectedContexts}
          setSelectedStatus={setSelectedStatus}
          setSelectedTags={setSelectedTags}
          setSelectedTimeRange={setSelectedTimeRange}
        />
        <TodoBoard
          currentDate={currentDate}
          selectedContexts={selectedContexts}
          selectedStatus={selectedStatus}
          selectedTags={selectedTags}
          selectedTimeRange={selectedTimeRange}
        />
      </PageWrapper>
    </DatabaseChangesProvider>
  );
}

export function Eddo() {
  const { username, isAuthenticated, authenticate, register, logout, isAuthenticating } = useAuth();

  // Create user-specific PouchDB context when authenticated
  const pouchDbContext = useMemo(() => {
    if (isAuthenticated && username) {
      return createUserPouchDbContext(username);
    }
    // Fallback to default context for unauthenticated state
    return null;
  }, [isAuthenticated, username]);

  // Create QueryClient instance once
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <PouchDbContext.Provider value={pouchDbContext}>
        <AuthenticatedApp
          authenticate={authenticate}
          isAuthenticated={isAuthenticated}
          isAuthenticating={isAuthenticating}
          logout={logout}
          register={register}
        />
      </PouchDbContext.Provider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
