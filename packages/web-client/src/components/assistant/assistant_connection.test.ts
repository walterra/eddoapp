import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssistantConnection, type AssistantLiveConnection } from './assistant_connection';
import { sessionFixture } from './assistant_test_helpers';
import { AssistantClientError } from './assistant_types';

const connections: AssistantLiveConnection[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const connection of connections.splice(0)) connection.stop();
  vi.useRealTimers();
});
function fixture() {
  const { client } = sessionFixture();
  const state = vi.fn();
  const connection = createAssistantConnection({
    client,
    refresh: vi.fn().mockResolvedValue('snapshot-12'),
    requestIds: () => [],
    event: vi.fn(),
    state,
  });
  connections.push(connection);
  return { client, state, connection };
}

describe('assistant read-only reconnect lifecycle', () => {
  it('honors Retry-After without resubmitting messages', async () => {
    const test = fixture();
    vi.mocked(test.client.stream).mockRejectedValue(new AssistantClientError('rate_limited', 60));
    test.connection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(test.client.stream).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(test.client.stream).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(test.client.stream).toHaveBeenCalledTimes(2);
    expect(test.client.admit).not.toHaveBeenCalled();
  });

  it('retains the last processed event cursor through reconnects', async () => {
    const test = fixture();
    vi.mocked(test.client.stream).mockImplementationOnce(async (request) => {
      request.onEvent({ event: 'checkpoint', data: { cursor: 'resume-13' }, id: 'resume-13' });
      throw new AssistantClientError('network');
    });
    test.connection.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(vi.mocked(test.client.stream).mock.calls[1][0].cursor).toBe('resume-13');
  });

  it('stops reconnecting after authorization revocation until explicitly refreshed', async () => {
    const test = fixture();
    vi.mocked(test.client.stream).mockRejectedValue(new AssistantClientError('forbidden'));
    test.connection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(test.state).toHaveBeenCalledWith('blocked', 'forbidden');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(test.client.stream).toHaveBeenCalledOnce();
    expect(test.connection.signal()?.aborted).toBe(true);
  });
});
