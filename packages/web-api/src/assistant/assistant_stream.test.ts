// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { changeCursor } from './assistant_cursors';
import { AssistantApiError } from './assistant_errors';
import { runAssistantStream } from './assistant_stream';
import { assistantServiceFixture, durableRequestId } from './assistant_test_helpers';
import { AssistantCursorExpiredError } from './assistant_types';

interface SentEvent {
  event: string;
  data: unknown;
  id?: string;
}
function fixture() {
  const service = assistantServiceFixture();
  const controller = new AbortController();
  const sent: SentEvent[] = [];
  const sink = {
    send: vi.fn().mockImplementation(async (event: string, data: unknown, id?: string) => {
      sent.push({ event, data, id });
      if (event === 'checkpoint') controller.abort();
    }),
  };
  const identity = { username: 'alice', expiresAt: Date.now() + 60_000 };
  const options = { since: '12', requestIds: [durableRequestId], signal: controller.signal };
  return { service, controller, sent, sink, identity, options };
}

describe('durable assistant SSE replay', () => {
  it('resumes persisted changes and refreshes tracked request status without admitting work', async () => {
    const test = fixture();
    vi.mocked(test.service.store.changes).mockResolvedValueOnce({
      changes: [{ sequence: '13', change: { kind: 'message', documentId: 'assistant_message_1' } }],
      lastSequence: '13',
    });
    await runAssistantStream(test.service, test.identity, test.options, test.sink);
    expect(test.service.store.changes).toHaveBeenCalledWith('alice', '12', test.controller.signal);
    expect(test.sent).toContainEqual({
      event: 'history-change',
      data: { kind: 'message', documentId: 'assistant_message_1' },
      id: changeCursor('alice', '13'),
    });
    expect(test.sent.some((event) => event.event === 'request-status')).toBe(true);
    expect(test.service.host.admit).not.toHaveBeenCalled();
  });

  it('revalidates access after polling and emits no changes after revocation', async () => {
    const test = fixture();
    vi.mocked(test.service.store.changes).mockImplementationOnce(async () => {
      vi.mocked(test.service.authorize).mockRejectedValue(new AssistantApiError(403, 'forbidden'));
      return {
        changes: [{ sequence: '13', change: { kind: 'message', documentId: 'private' } }],
        lastSequence: '13',
      };
    });
    await runAssistantStream(test.service, test.identity, test.options, test.sink);
    expect(test.sent.some((event) => event.event === 'history-change')).toBe(false);
    expect(test.sent.at(-1)?.data).toEqual({ error: 'forbidden' });
  });

  it('recovers rejected CouchDB checkpoints through an explicit history reset', async () => {
    const test = fixture();
    vi.mocked(test.service.store.changes).mockRejectedValueOnce(new AssistantCursorExpiredError());
    vi.mocked(test.service.store.watermark).mockResolvedValue('25');
    await runAssistantStream(test.service, test.identity, test.options, test.sink);
    expect(test.sent).toContainEqual({
      event: 'checkpoint',
      data: { cursor: changeCursor('alice', '25') },
      id: changeCursor('alice', '25'),
    });
    expect(test.sent.some((event) => event.event === 'reset')).toBe(true);
  });

  it('keeps history updates available while the execution host restarts', async () => {
    const test = fixture();
    vi.mocked(test.service.host.status).mockRejectedValue(
      new AssistantApiError(503, 'unavailable'),
    );
    vi.mocked(test.service.store.changes).mockResolvedValueOnce({
      changes: [],
      lastSequence: '13',
    });
    await runAssistantStream(test.service, test.identity, test.options, test.sink);
    expect(test.sent.some((event) => event.event === 'unavailable')).toBe(true);
    expect(test.sent.some((event) => event.event === 'checkpoint')).toBe(true);
  });

  it('stops before reading private state when the session expires or the browser disconnects', async () => {
    const test = fixture();
    await runAssistantStream(
      test.service,
      { ...test.identity, expiresAt: 1 },
      test.options,
      test.sink,
    );
    expect(test.sent.at(-1)?.data).toEqual({ error: 'unauthorized' });
    test.controller.abort();
    await runAssistantStream(test.service, test.identity, test.options, test.sink);
    expect(test.service.store.changes).not.toHaveBeenCalled();
  });
});
