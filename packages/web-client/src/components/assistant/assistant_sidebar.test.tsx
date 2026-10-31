import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Thread } from '../chat/assistant-ui/thread';
import { ChatRuntimeProvider } from '../chat/chat_runtime_provider';
import { AssistantSidebar } from './assistant_sidebar';
import {
  deferred,
  historyPage,
  projectedMessage,
  projectionIds,
  submissionId,
} from './assistant_test_helpers';
import type { AssistantSession, AssistantSnapshot } from './assistant_types';

const fixture = vi.hoisted(() => ({
  state: null as AssistantSnapshot | null,
  session: null as AssistantSession | null,
  logout: vi.fn(),
}));
vi.mock('../../hooks/use_auth', () => ({
  useAuth: () => ({ authToken: { username: 'alice', token: 'jwt' }, logout: fixture.logout }),
}));
vi.mock('./use_assistant_session', () => ({
  useAssistantSession: () => ({ state: fixture.state, session: fixture.session }),
}));

beforeEach(() => {
  fixture.state = {
    ...historyPage(),
    messages: [
      projectedMessage('user', 1),
      {
        ...projectedMessage('assistant', 2),
        content: '**Shared reply** [Docs](https://example.com)',
      },
    ],
    loading: false,
    loadingOlder: false,
    submitting: false,
    connection: 'connected',
    pending: null,
    error: null,
  };
  fixture.session = {
    send: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn(),
    refresh: vi.fn(),
    loadOlder: vi.fn(),
    dismiss: vi.fn(),
    subscribe: () => () => {},
    getSnapshot: () => fixture.state!,
    start: vi.fn(),
    stop: vi.fn(),
  };
  function TestObserver(this: ResizeObserver): void {
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  }
  vi.stubGlobal('ResizeObserver', TestObserver);
  vi.stubGlobal('IntersectionObserver', TestObserver);
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('shared assistant sidebar', () => {
  it('renders recovered shared activity without exposing cancellation or needing a local submission', () => {
    fixture.state!.sharedRequests = [
      { requestId: 'telegram:bot:1', conversationId: 'active', status: 'working' },
    ];
    render(<AssistantSidebar onClose={vi.fn()} />);
    expect(screen.getByText('1 shared request in progress.')).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Assistant response pending' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop generation' })).toBeNull();
    expect(fixture.session?.send).not.toHaveBeenCalled();
  });
  it('renders the shared transcript and Markdown using assistant-ui without sandbox controls', async () => {
    render(<AssistantSidebar onClose={vi.fn()} />);
    expect(screen.getByRole('complementary', { name: 'Assistant' })).toBeTruthy();
    expect(await screen.findByText('Shared reply')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe(
      'https://example.com',
    );
    expect(screen.queryByText('New Session')).toBeNull();
    expect(screen.queryByText('Start Session')).toBeNull();
    expect(screen.queryByText('API Key Required')).toBeNull();
    const input = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(input, { target: { value: 'Continue from Telegram' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() =>
      expect(fixture.session?.send).toHaveBeenCalledWith('Continue from Telegram'),
    );
  });

  it('shows durable working state without offering unsupported cancellation', async () => {
    fixture.state!.pending = {
      username: 'alice',
      submissionId,
      text: 'Hello',
      createdAt: '2026-10-29T00:00:00.000Z',
      conversationId: 'active',
      projectionIds,
      receipt: {
        requestId: `web:alice:${submissionId}`,
        conversationId: 'active',
        status: 'working',
      },
    };
    render(<AssistantSidebar onClose={vi.fn()} />);
    expect(await screen.findByText('Working')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop generation' })).toBeNull();
    expect(screen.getByRole('status', { name: 'Assistant response pending' })).toBeTruthy();
  });

  it('preserves cancellation for sandbox threads by default', async () => {
    const gate = deferred<void>();
    const cancel = vi.fn().mockResolvedValue(undefined);
    render(
      <ChatRuntimeProvider
        initialMessages={[]}
        onCancel={cancel}
        onSendMessage={async () => gate.promise}
      >
        <Thread showReasoning={false} />
      </ChatRuntimeProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Sandbox request' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    try {
      fireEvent.click(await screen.findByRole('button', { name: 'Stop generation' }));
      await waitFor(() => expect(cancel).toHaveBeenCalledOnce());
    } finally {
      await act(async () => gate.resolve(undefined));
    }
  });

  it('stays docked on narrow screens, handles Escape, and restores focus after closing', async () => {
    vi.stubGlobal('innerWidth', 375);
    const trigger = document.createElement('button');
    trigger.textContent = 'Assistant trigger';
    document.body.append(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const view = render(<AssistantSidebar onClose={onClose} />);
    const sidebar = screen.getByRole('complementary', { name: 'Assistant' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(sidebar, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    view.unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
