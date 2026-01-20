import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { GlobalTodoFlyout } from './components/global_todo_flyout';
import { Login } from './components/login';
import { PageWrapper } from './components/page_wrapper';
import { Register } from './components/register';
import type { CompletionStatus } from './components/status_filter';
import type { TimeRange } from './components/time_range_filter';
import { TodoFilters } from './components/todo_filters';
import { createQueryClient } from './config/query_client';
import { AuthProvider, useAuth } from './hooks/use_auth';
import { useCouchDbSync } from './hooks/use_couchdb_sync';
import { DatabaseChangesProvider } from './hooks/use_database_changes';
import { useDatabaseHealth } from './hooks/use_database_health';
import { useFilterPreferences } from './hooks/use_filter_preferences';
import { HighlightProvider } from './hooks/use_highlight_context';
import { usePreferencesStream } from './hooks/use_preferences_stream';
import { initializeTheme } from './hooks/use_theme';
import { TodoFlyoutProvider } from './hooks/use_todo_flyout';
import { useViewPreferences } from './hooks/use_view_preferences';
import { createUserPouchDbContext } from './pouch_db';
import { PouchDbContext } from './pouch_db_types';

// Lazy load view components - loaded only when user navigates to that view
const TodoBoard = lazy(() =>
  import('./components/todo_board').then((m) => ({ default: m.TodoBoard })),
);
const TodoTable = lazy(() =>
  import('./components/todo_table').then((m) => ({ default: m.TodoTable })),
);
const TodoGraph = lazy(() =>
  import('./components/todo_graph').then((m) => ({ default: m.TodoGraph })),
);

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

/** Hook for filter preference handlers */
function useFilterHandlers() {
  const prefs = useFilterPreferences();
  return {
    prefs,
    handleCurrentDateChange: (date: Date) => {
      prefs.setCurrentDate(date);
    },
    handleSelectedTagsChange: (tags: string[]) => {
      prefs.setSelectedTags(tags);
    },
    handleSelectedContextsChange: (contexts: string[]) => {
      prefs.setSelectedContexts(contexts);
    },
    handleSelectedStatusChange: (status: CompletionStatus) => {
      prefs.setSelectedStatus(status);
    },
    handleSelectedTimeRangeChange: (timeRange: TimeRange) => {
      prefs.setSelectedTimeRange(timeRange);
    },
  };
}

/** Todo filters with view mode handling */
function TodoFiltersSection({
  handlers,
  viewPrefs,
}: {
  handlers: ReturnType<typeof useFilterHandlers>;
  viewPrefs: ReturnType<typeof useViewPreferences>;
}) {
  const { prefs, ...rest } = handlers;
  const { viewMode, tableColumns, isLoading, setViewMode, setTableColumns } = viewPrefs;
  return (
    <TodoFilters
      batchUpdateFilters={prefs.batchUpdate}
      currentDate={prefs.currentDate}
      isViewPrefsLoading={isLoading}
      onTableColumnsChange={async (cols) => {
        await setTableColumns(cols);
      }}
      onViewModeChange={async (mode) => {
        await setViewMode(mode);
      }}
      selectedContexts={prefs.selectedContexts}
      selectedStatus={prefs.selectedStatus}
      selectedTags={prefs.selectedTags}
      selectedTimeRange={prefs.selectedTimeRange}
      setCurrentDate={rest.handleCurrentDateChange}
      setSelectedContexts={rest.handleSelectedContextsChange}
      setSelectedStatus={rest.handleSelectedStatusChange}
      setSelectedTags={rest.handleSelectedTagsChange}
      setSelectedTimeRange={rest.handleSelectedTimeRangeChange}
      tableColumns={tableColumns}
      viewMode={viewMode}
    />
  );
}

/** Loading fallback for lazy-loaded views */
function ViewLoadingFallback() {
  return (
    <div className="flex h-96 items-center justify-center">
      <div className="text-center">
        <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading view...</p>
      </div>
    </div>
  );
}

/** Todo content view (board or table) */
function TodoContentView({
  prefs,
  viewMode,
  tableColumns,
}: {
  prefs: ReturnType<typeof useFilterPreferences>;
  viewMode: string;
  tableColumns: string[];
}) {
  const common = {
    currentDate: prefs.currentDate,
    selectedContexts: prefs.selectedContexts,
    selectedStatus: prefs.selectedStatus,
    selectedTags: prefs.selectedTags,
    selectedTimeRange: prefs.selectedTimeRange,
  };

  const renderView = () => {
    switch (viewMode) {
      case 'kanban':
        return <TodoBoard {...common} />;
      case 'table':
        return <TodoTable {...common} selectedColumns={tableColumns} />;
      case 'graph':
        return <TodoGraph {...common} />;
      default:
        return <TodoBoard {...common} />;
    }
  };

  return <Suspense fallback={<ViewLoadingFallback />}>{renderView()}</Suspense>;
}

/** Authenticated todo app content */
function TodoApp({ logout }: { logout: () => void }) {
  const viewPrefs = useViewPreferences();
  const handlers = useFilterHandlers();
  return (
    <PageWrapper isAuthenticated={true} logout={logout}>
      <TodoFiltersSection handlers={handlers} viewPrefs={viewPrefs} />
      <TodoContentView
        prefs={handlers.prefs}
        tableColumns={viewPrefs.tableColumns}
        viewMode={viewPrefs.viewMode}
      />
    </PageWrapper>
  );
}

function AuthenticatedApp({
  authenticate,
  register,
  logout,
  isAuthenticated,
  isAuthenticating,
}: AuthenticatedAppProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  useEffect(() => {
    if (!isAuthenticated) setAuthMode('login');
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return authMode === 'register' ? (
      <Register
        isAuthenticating={isAuthenticating}
        onBackToLogin={() => setAuthMode('login')}
        onRegister={register}
      />
    ) : (
      <Login
        isAuthenticating={isAuthenticating}
        onGoToRegister={() => setAuthMode('register')}
        onLogin={authenticate}
      />
    );
  }

  return (
    <DatabaseChangesProvider>
      <HighlightProvider>
        <TodoFlyoutProvider>
          <CouchdbSyncProvider />
          <PreferencesStreamProvider />
          <HealthMonitor />
          <TodoApp logout={logout} />
          <GlobalTodoFlyout />
        </TodoFlyoutProvider>
      </HighlightProvider>
    </DatabaseChangesProvider>
  );
}

function EddoContent() {
  const { username, isAuthenticated, authenticate, register, logout, isAuthenticating } = useAuth();

  // Create PouchDB context - recreated when username changes
  // Note: We don't close the old database here because PouchDB handles
  // multiple instances gracefully, and closing causes issues with in-flight operations
  const pouchDbContext = useMemo(
    () => (isAuthenticated && username ? createUserPouchDbContext(username) : null),
    [isAuthenticated, username],
  );

  // Recreate queryClient when username changes to clear cache between users
  const queryClient = useMemo(() => createQueryClient(), [username]);

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

// Initialize theme before React renders to prevent flash of wrong theme
initializeTheme();

export function Eddo() {
  return (
    <AuthProvider>
      <EddoContent />
    </AuthProvider>
  );
}
