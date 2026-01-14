/**
 * Tests for SessionList component
 */

import type { ChatSession } from '@eddo/core-shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SessionList } from './session_list';

// Mock the hooks
vi.mock('../../hooks/use_chat_api', () => ({
  useChatSessions: vi.fn(),
  useStartSession: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useStopSession: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

import { useChatSessions } from '../../hooks/use_chat_api';

const mockUseChatSessions = vi.mocked(useChatSessions);

/** Create a test query client */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/** Wrapper component for tests */
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Create mock session */
function createMockSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    _id: 'session-1',
    version: 'alpha1',
    username: 'testuser',
    name: 'Test Session',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    containerState: 'stopped',
    worktreeState: 'ready',
    stats: {
      messageCount: 5,
      userMessageCount: 2,
      assistantMessageCount: 3,
      toolCallCount: 1,
      inputTokens: 1000,
      outputTokens: 500,
      totalCost: 0.05,
    },
    ...overrides,
  };
}

describe('SessionList', () => {
  const defaultProps = {
    selectedSessionId: null,
    onSelectSession: vi.fn(),
    onDeleteSession: vi.fn(),
    onNewSession: vi.fn(),
  };

  it('renders loading state', () => {
    mockUseChatSessions.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useChatSessions>);

    render(
      <TestWrapper>
        <SessionList {...defaultProps} />
      </TestWrapper>,
    );

    expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
  });

  it('renders empty state when no sessions', () => {
    mockUseChatSessions.mockReturnValue({
      data: [] as ChatSession[],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useChatSessions>);

    render(
      <TestWrapper>
        <SessionList {...defaultProps} />
      </TestWrapper>,
    );

    expect(screen.getByText('No chat sessions yet')).toBeInTheDocument();
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseChatSessions.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
    } as ReturnType<typeof useChatSessions>);

    render(
      <TestWrapper>
        <SessionList {...defaultProps} />
      </TestWrapper>,
    );

    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('renders session list', () => {
    const sessions = [
      createMockSession({ _id: 'session-1', name: 'First Session' }),
      createMockSession({ _id: 'session-2', name: 'Second Session' }),
    ];

    mockUseChatSessions.mockReturnValue({
      data: sessions,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useChatSessions>);

    render(
      <TestWrapper>
        <SessionList {...defaultProps} />
      </TestWrapper>,
    );

    expect(screen.getByText('First Session')).toBeInTheDocument();
    expect(screen.getByText('Second Session')).toBeInTheDocument();
  });

  it('shows status badges correctly', () => {
    const sessions = [
      createMockSession({ _id: 'session-1', name: 'Active Session', containerState: 'running' }),
      createMockSession({ _id: 'session-2', name: 'Inactive Session', containerState: 'stopped' }),
    ];

    mockUseChatSessions.mockReturnValue({
      data: sessions,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useChatSessions>);

    render(
      <TestWrapper>
        <SessionList {...defaultProps} />
      </TestWrapper>,
    );

    // Check session names are present
    expect(screen.getByText('Active Session')).toBeInTheDocument();
    expect(screen.getByText('Inactive Session')).toBeInTheDocument();
    // Check status badges (there's one Running and one Stopped badge)
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('shows session stats', () => {
    const sessions = [createMockSession({ name: 'Test' })];

    mockUseChatSessions.mockReturnValue({
      data: sessions,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useChatSessions>);

    render(
      <TestWrapper>
        <SessionList {...defaultProps} />
      </TestWrapper>,
    );

    expect(screen.getByText('5 messages')).toBeInTheDocument();
    expect(screen.getByText('1.5K tokens')).toBeInTheDocument();
    expect(screen.getByText('$0.05')).toBeInTheDocument();
  });
});
