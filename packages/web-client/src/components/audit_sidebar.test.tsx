import { type Todo } from '@eddo/core-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditLogAlpha1, AuditSource } from '@eddo/core-shared';

import { HighlightProvider } from '../hooks/use_highlight_context';
import { TodoFlyoutProvider } from '../hooks/use_todo_flyout';
import { PouchDbContext, type PouchDbContextType } from '../pouch_db_types';

import { AuditSidebar } from './audit_sidebar';

/** Entries grouped by source type */
type AuditEntriesBySource = Record<AuditSource, AuditLogAlpha1[]>;

/** Create empty buckets for mocks */
function createEmptyBuckets(): AuditEntriesBySource {
  return {
    web: [],
    mcp: [],
    telegram: [],
    'github-sync': [],
    'rss-sync': [],
    'email-sync': [],
  };
}

/** Create mock return value for useAuditLog */
function createMockAuditLogReturn(entries: AuditLogAlpha1[] = []) {
  const entriesBySource: AuditEntriesBySource = createEmptyBuckets();
  for (const entry of entries) {
    entriesBySource[entry.source].push(entry);
  }

  return {
    entriesBySource,
    entries,
    isLoading: false,
    error: null,
    isConnected: true,
    connectionError: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    reconnect: vi.fn(),
    getFilteredEntries: (source: AuditSource | 'all', limit = 20) => {
      if (source === 'all') {
        return entries.slice(0, limit);
      }
      return entriesBySource[source].slice(0, limit);
    },
  };
}

// Mock the hooks
vi.mock('../hooks/use_audit_log_data', () => ({
  useAuditLog: vi.fn(() => createMockAuditLogReturn()),
}));

vi.mock('../hooks/use_auth', () => ({
  useAuth: vi.fn(() => ({
    authToken: { token: 'test-token' },
    isAuthenticated: true,
  })),
}));

const mockSafeGet = vi.fn();

const mockPouchDbContext = {
  safeDb: {
    safeGet: mockSafeGet,
    safePut: vi.fn(),
    safeRemove: vi.fn(),
    safeAllDocs: vi.fn(),
    safeBulkDocs: vi.fn(),
    safeQuery: vi.fn(),
    safeFind: vi.fn(),
  },
  changes: vi.fn(),
  sync: vi.fn(),
  healthMonitor: {} as PouchDbContextType['healthMonitor'],
  rawDb: { name: 'test-db' } as unknown as PouchDB.Database,
} as PouchDbContextType;

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <PouchDbContext.Provider value={mockPouchDbContext}>
        <HighlightProvider>
          <TodoFlyoutProvider>{ui}</TodoFlyoutProvider>
        </HighlightProvider>
      </PouchDbContext.Provider>
    </QueryClientProvider>,
  );
};

describe('AuditSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sidebar header with Activity title', () => {
    renderWithProviders(<AuditSidebar isOpen={true} />);
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('shows empty state when no entries', () => {
    renderWithProviders(<AuditSidebar isOpen={true} />);
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('shows connection indicator', () => {
    renderWithProviders(<AuditSidebar isOpen={true} />);
    // Green dot for connected state
    const indicator = document.querySelector('.bg-green-500');
    expect(indicator).toBeInTheDocument();
  });

  it('renders collapse button', () => {
    renderWithProviders(<AuditSidebar isOpen={true} />);
    expect(screen.getByTitle('Collapse sidebar')).toBeInTheDocument();
  });
});

describe('AuditSidebar with entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders audit entries', async () => {
    const mockEntries: AuditLogAlpha1[] = [
      {
        _id: '2026-01-07T12:00:00.000Z',
        version: 'audit_alpha1' as const,
        action: 'create' as const,
        entityType: 'todo' as const,
        entityId: '2026-01-07T11:00:00.000Z',
        timestamp: '2026-01-07T12:00:00.000Z',
        source: 'web' as const,
        after: { title: 'Test Todo' },
      },
    ];

    const { useAuditLog } = await import('../hooks/use_audit_log_data');
    vi.mocked(useAuditLog).mockReturnValue(createMockAuditLogReturn(mockEntries));

    renderWithProviders(<AuditSidebar isOpen={true} />);
    expect(screen.getByText('Test Todo')).toBeInTheDocument();
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });

  it('renders message when present', async () => {
    const mockEntries: AuditLogAlpha1[] = [
      {
        _id: '2026-01-07T12:00:00.000Z',
        version: 'audit_alpha1' as const,
        action: 'update' as const,
        entityType: 'todo' as const,
        entityId: '2026-01-07T11:00:00.000Z',
        timestamp: '2026-01-07T12:00:00.000Z',
        source: 'mcp' as const,
        after: { title: 'Test Todo' },
        message: 'Added due date for next week',
      },
    ];

    const { useAuditLog } = await import('../hooks/use_audit_log_data');
    vi.mocked(useAuditLog).mockReturnValue(createMockAuditLogReturn(mockEntries));

    renderWithProviders(<AuditSidebar isOpen={true} />);
    expect(screen.getByText('Test Todo')).toBeInTheDocument();
    expect(screen.getByText('Added due date for next week')).toBeInTheDocument();
  });

  it('does not render message element when not present', async () => {
    const mockEntries: AuditLogAlpha1[] = [
      {
        _id: '2026-01-07T12:00:00.000Z',
        version: 'audit_alpha1' as const,
        action: 'create' as const,
        entityType: 'todo' as const,
        entityId: '2026-01-07T11:00:00.000Z',
        timestamp: '2026-01-07T12:00:00.000Z',
        source: 'web' as const,
        after: { title: 'Test Todo Without Message' },
      },
    ];

    const { useAuditLog } = await import('../hooks/use_audit_log_data');
    vi.mocked(useAuditLog).mockReturnValue(createMockAuditLogReturn(mockEntries));

    renderWithProviders(<AuditSidebar isOpen={true} />);
    expect(screen.getByText('Test Todo Without Message')).toBeInTheDocument();
    // No italic message element should exist
    const italicElements = document.querySelectorAll('.italic');
    expect(italicElements).toHaveLength(0);
  });

  it('makes entries clickable and fetches todo on click', async () => {
    const mockTodo: Todo = {
      _id: '2026-01-07T11:00:00.000Z',
      _rev: '1-abc',
      title: 'Test Todo',
      description: '',
      context: 'work',
      tags: [],
      due: '2026-01-08',
      completed: null,
      active: {},
      link: null,
      repeat: null,
      version: 'alpha3',
    };

    mockSafeGet.mockResolvedValue(mockTodo);

    const mockEntries: AuditLogAlpha1[] = [
      {
        _id: '2026-01-07T12:00:00.000Z',
        version: 'audit_alpha1' as const,
        action: 'create' as const,
        entityType: 'todo' as const,
        entityId: '2026-01-07T11:00:00.000Z',
        timestamp: '2026-01-07T12:00:00.000Z',
        source: 'web' as const,
        after: { title: 'Test Todo' },
      },
    ];

    const { useAuditLog } = await import('../hooks/use_audit_log_data');
    vi.mocked(useAuditLog).mockReturnValue(createMockAuditLogReturn(mockEntries));

    renderWithProviders(<AuditSidebar isOpen={true} />);

    const entryButton = screen.getByRole('button', { name: /Test Todo/i });
    fireEvent.click(entryButton);

    await waitFor(() => {
      expect(mockSafeGet).toHaveBeenCalledWith('2026-01-07T11:00:00.000Z');
    });
  });

  it('disables deleted entries', async () => {
    const mockEntries: AuditLogAlpha1[] = [
      {
        _id: '2026-01-07T12:00:00.000Z',
        version: 'audit_alpha1' as const,
        action: 'create' as const,
        entityType: 'todo' as const,
        entityId: '2026-01-07T11:00:00.000Z',
        timestamp: '2026-01-07T12:00:00.000Z',
        source: 'web' as const,
        after: { title: 'Test Todo' },
      },
      {
        _id: '2026-01-07T13:00:00.000Z',
        version: 'audit_alpha1' as const,
        action: 'delete' as const,
        entityType: 'todo' as const,
        entityId: '2026-01-07T11:00:00.000Z',
        timestamp: '2026-01-07T13:00:00.000Z',
        source: 'web' as const,
        before: { title: 'Test Todo' },
      },
    ];

    const { useAuditLog } = await import('../hooks/use_audit_log_data');
    vi.mocked(useAuditLog).mockReturnValue(createMockAuditLogReturn(mockEntries));

    renderWithProviders(<AuditSidebar isOpen={true} />);

    // Both entries should be visible
    const buttons = screen.getAllByRole('button', { name: /Test Todo/i });
    expect(buttons).toHaveLength(2);

    // Both should be disabled since the entity was deleted
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('filters entries by source when filter is selected', async () => {
    const mockEntries: AuditLogAlpha1[] = [
      {
        _id: '2026-01-07T12:00:00.000Z',
        version: 'audit_alpha1' as const,
        action: 'create' as const,
        entityType: 'todo' as const,
        entityId: '2026-01-07T11:00:00.000Z',
        timestamp: '2026-01-07T12:00:00.000Z',
        source: 'web' as const,
        after: { title: 'Web Todo' },
      },
      {
        _id: '2026-01-07T13:00:00.000Z',
        version: 'audit_alpha1' as const,
        action: 'create' as const,
        entityType: 'todo' as const,
        entityId: '2026-01-07T12:00:00.000Z',
        timestamp: '2026-01-07T13:00:00.000Z',
        source: 'mcp' as const,
        after: { title: 'MCP Todo' },
      },
    ];

    const { useAuditLog } = await import('../hooks/use_audit_log_data');
    vi.mocked(useAuditLog).mockReturnValue(createMockAuditLogReturn(mockEntries));

    renderWithProviders(<AuditSidebar isOpen={true} />);

    // Initially shows all
    expect(screen.getByText('Web Todo')).toBeInTheDocument();
    expect(screen.getByText('MCP Todo')).toBeInTheDocument();

    // Click MCP filter
    const mcpFilterButton = screen.getByRole('button', { name: 'MCP' });
    fireEvent.click(mcpFilterButton);

    // Should only show MCP entries
    expect(screen.queryByText('Web Todo')).not.toBeInTheDocument();
    expect(screen.getByText('MCP Todo')).toBeInTheDocument();
  });
});
