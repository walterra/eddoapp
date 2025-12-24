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
import { TodoTable } from './components/todo_table';
import { createQueryClient } from './config/query_client';
import { useAuth } from './hooks/use_auth';
import { useCouchDbSync } from './hooks/use_couchdb_sync';
import { DatabaseChangesProvider } from './hooks/use_database_changes';
import { useDatabaseHealth } from './hooks/use_database_health';
import { useFilterPreferences } from './hooks/use_filter_preferences';
import { usePreferencesStream } from './hooks/use_preferences_stream';
import { useViewPreferences } from './hooks/use_view_preferences';
import { createUserPouchDbContext } from './pouch_db';
import { PouchDbContext } from './pouch_db_types';

function CouchdbSyncProvider() {
  useCouchDbSync();
  return null;
}

function PreferencesStreamProvider() {
  usePreferencesStream();
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
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // View preferences
  const {
    viewMode,
    tableColumns,
    isLoading: isViewPrefsLoading,
    setViewMode,
    setTableColumns,
  } = useViewPreferences();

  // Filter preferences
  const {
    currentDate,
    selectedTags,
    selectedContexts,
    selectedStatus,
    selectedTimeRange,
    setCurrentDate,
    setSelectedTags,
    setSelectedContexts,
    setSelectedStatus,
    setSelectedTimeRange,
  } = useFilterPreferences();

  const handleViewModeChange = async (mode: typeof viewMode) => {
    await setViewMode(mode);
  };

  const handleTableColumnsChange = async (columns: string[]) => {
    await setTableColumns(columns);
  };

  // Wrapper functions for filter preferences (async updates in background)
  const handleCurrentDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleSelectedTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const handleSelectedContextsChange = (contexts: string[]) => {
    setSelectedContexts(contexts);
  };

  const handleSelectedStatusChange = (status: CompletionStatus) => {
    setSelectedStatus(status);
  };

  const handleSelectedTimeRangeChange = (timeRange: TimeRange) => {
    setSelectedTimeRange(timeRange);
  };

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
      <PreferencesStreamProvider />
      <HealthMonitor />
      <PageWrapper isAuthenticated={isAuthenticated} logout={logout}>
        <AddTodo />
        <TodoFilters
          currentDate={currentDate}
          isViewPrefsLoading={isViewPrefsLoading}
          onTableColumnsChange={handleTableColumnsChange}
          onViewModeChange={handleViewModeChange}
          selectedContexts={selectedContexts}
          selectedStatus={selectedStatus}
          selectedTags={selectedTags}
          selectedTimeRange={selectedTimeRange}
          setCurrentDate={handleCurrentDateChange}
          setSelectedContexts={handleSelectedContextsChange}
          setSelectedStatus={handleSelectedStatusChange}
          setSelectedTags={handleSelectedTagsChange}
          setSelectedTimeRange={handleSelectedTimeRangeChange}
          tableColumns={tableColumns}
          viewMode={viewMode}
        />
        {viewMode === 'kanban' ? (
          <TodoBoard
            currentDate={currentDate}
            selectedContexts={selectedContexts}
            selectedStatus={selectedStatus}
            selectedTags={selectedTags}
            selectedTimeRange={selectedTimeRange}
          />
        ) : (
          <TodoTable
            currentDate={currentDate}
            selectedColumns={tableColumns}
            selectedContexts={selectedContexts}
            selectedStatus={selectedStatus}
            selectedTags={selectedTags}
            selectedTimeRange={selectedTimeRange}
          />
        )}
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
