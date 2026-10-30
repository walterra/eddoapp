// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startInternalAssistantServer, type InternalAssistantServer } from './internal_server.js';

const servers: InternalAssistantServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

it('serves authenticated admission on an ephemeral loopback listener', async () => {
  const token = 'loopback-test-token-at-least-32-characters';
  const input = {
    username: 'alice',
    requestId: '70f72756-993e-4cae-8108-f6b723391ae1',
    text: 'Hello',
  };
  const receipt = {
    requestId: `web:alice:${input.requestId}`,
    conversationId: 'active',
    status: 'queued' as const,
  };
  const admit = vi.fn().mockResolvedValue(receipt);
  const server = await startInternalAssistantServer({ port: 0, token, admit, status: vi.fn() });
  servers.push(server);
  const response = await fetch(`http://127.0.0.1:${server.port}/internal/assistant/admit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual(receipt);
  expect(admit).toHaveBeenCalledExactlyOnceWith(input);
});

describe('internal listener configuration', () => {
  it('rejects an absent secret before binding a listener', async () => {
    await expect(
      startInternalAssistantServer({ port: 0, token: '', admit: vi.fn(), status: vi.fn() }),
    ).rejects.toThrow('32');
  });
});
