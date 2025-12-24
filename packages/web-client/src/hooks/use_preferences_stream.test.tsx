import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePreferencesStream } from './use_preferences_stream';

// Mock useAuth hook
vi.mock('./use_auth', () => ({
  useAuth: vi.fn(() => ({
    authToken: { token: 'test-token', username: 'testuser' },
    isAuthenticated: true,
  })),
}));

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private listeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      const index = typeListeners.indexOf(listener);
      if (index > -1) {
        typeListeners.splice(index, 1);
      }
    }
  }

  close() {
    this.readyState = 2;
  }

  // Test helper to simulate events
  simulateEvent(type: string, data: string, lastEventId?: string) {
    const event = new MessageEvent(type, {
      data,
      lastEventId,
    });
    const typeListeners = this.listeners.get(type) || [];
    typeListeners.forEach((listener) => listener(event));
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

// Replace global EventSource
const originalEventSource = globalThis.EventSource;

describe('usePreferencesStream', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    MockEventSource.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
    queryClient.clear();
  });

  it('should connect to SSE endpoint when authenticated', async () => {
    renderHook(() => usePreferencesStream(), { wrapper });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const eventSource = MockEventSource.instances[0];
    expect(eventSource.url).toContain('/api/users/preferences/stream');
    expect(eventSource.url).toContain('token=test-token');
  });

  it('should update connection state on open', async () => {
    const { result } = renderHook(() => usePreferencesStream(), { wrapper });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    expect(result.current.error).toBeNull();
  });

  it('should update React Query cache on preference-update event', async () => {
    const mockProfile = {
      userId: 'user_testuser',
      username: 'testuser',
      email: 'test@example.com',
      preferences: { dailyBriefing: true },
    };

    renderHook(() => usePreferencesStream(), { wrapper });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const eventSource = MockEventSource.instances[0];

    // Simulate receiving a preference update
    act(() => {
      eventSource.simulateEvent('preference-update', JSON.stringify(mockProfile), '1');
    });

    // Check that the query cache was updated
    await waitFor(() => {
      const cachedProfile = queryClient.getQueryData(['profile']);
      expect(cachedProfile).toEqual(mockProfile);
    });
  });

  it('should call onUpdate callback when provided', async () => {
    const onUpdate = vi.fn();

    renderHook(() => usePreferencesStream({ onUpdate }), { wrapper });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const eventSource = MockEventSource.instances[0];
    const mockProfile = { userId: 'user_test', preferences: {} };

    act(() => {
      eventSource.simulateEvent('preference-update', JSON.stringify(mockProfile), '1');
    });

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(mockProfile);
    });
  });

  it('should close connection when disabled', async () => {
    const { result, rerender } = renderHook(({ enabled }) => usePreferencesStream({ enabled }), {
      wrapper,
      initialProps: { enabled: true },
    });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const eventSource = MockEventSource.instances[0];
    expect(eventSource.readyState).toBe(1);

    // Disable the stream
    rerender({ enabled: false });

    await waitFor(() => {
      expect(eventSource.readyState).toBe(2); // Closed
      expect(result.current.isConnected).toBe(false);
    });
  });

  it('should not connect when not authenticated', async () => {
    // Override the mock for this test
    const useAuthMock = await import('./use_auth');
    vi.mocked(useAuthMock.useAuth).mockReturnValue({
      authToken: null,
      isAuthenticated: false,
      authenticate: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isAuthenticating: false,
      username: undefined,
      checkTokenExpiration: vi.fn(),
    });

    renderHook(() => usePreferencesStream(), { wrapper });

    // Wait a bit to ensure no connection is made
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(MockEventSource.instances.length).toBe(0);
  });
});
