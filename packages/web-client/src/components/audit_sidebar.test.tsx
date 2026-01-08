import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuditSidebar } from './audit_sidebar';

// Mock the hooks
vi.mock('../hooks/use_audit_log_data', () => ({
  useAuditLog: vi.fn(() => ({
    entries: [],
    isLoading: false,
    error: null,
    hasMore: false,
    isConnected: true,
    connectionError: null,
    refresh: vi.fn(),
    reconnect: vi.fn(),
  })),
}));

vi.mock('../hooks/use_auth', () => ({
  useAuth: vi.fn(() => ({
    authToken: { token: 'test-token' },
    isAuthenticated: true,
  })),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('AuditSidebar', () => {
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
  it('renders audit entries', async () => {
    const mockEntries = [
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
    vi.mocked(useAuditLog).mockReturnValue({
      entries: mockEntries,
      isLoading: false,
      error: null,
      hasMore: false,
      isConnected: true,
      connectionError: null,
      refresh: vi.fn(),
      reconnect: vi.fn(),
    });

    renderWithProviders(<AuditSidebar isOpen={true} />);
    expect(screen.getByText('Test Todo')).toBeInTheDocument();
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });
});
