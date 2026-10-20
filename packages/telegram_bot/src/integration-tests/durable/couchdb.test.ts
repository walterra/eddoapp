import { CouchDBContainer, type StartedCouchDBContainer } from '@testcontainers/couchdb';
import { randomUUID } from 'node:crypto';
import { fauxAssistantMessage } from 'pi-ai-durable/providers/faux';
import { openCouchDbStorage } from 'pi-durable-couchdb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { couchRequest, type CouchEndpoint } from '../../durable/couch.js';
import { openDurableRuntime, type DurableRuntime } from '../../durable/runtime.js';
import { createRuntimeFixture, createTestInput, deferred } from '../../durable/test_helpers.js';

vi.mock('../../utils/user-lookup.js', () => ({ lookupUserByTelegramId: vi.fn() }));

let container: StartedCouchDBContainer | undefined;
let endpoint: CouchEndpoint;
const runtimes: DurableRuntime[] = [];

beforeAll(async () => {
  const password = randomUUID();
  container = await new CouchDBContainer('couchdb:3.5.0')
    .withUsername('admin')
    .withPassword(password)
    .start();
  endpoint = {
    url: `http://${container.getHost()}:${container.getMappedPort(5984)}/pi_durable_test_${randomUUID().replaceAll('-', '')}`,
    headers: {
      Authorization: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  };
  const created = await couchRequest(endpoint, '', { method: 'PUT' });
  expect(created.status).toBe(201);
});

afterAll(async () => {
  await Promise.all(runtimes.map((runtime) => runtime.close()));
  if (container) await container.stop();
});

describe('real CouchDB durable Telegram execution', () => {
  it('recovers delivery and deduplicates updates from the published journal', async () => {
    const fixture = await createRuntimeFixture();
    await fixture.options.storage.close(
      (await import('@earendil-works/chord/context')).BACKGROUND_CONTEXT,
    );
    fixture.options.storage = await openCouchDbStorage(endpoint);
    fixture.provider.setResponses([fauxAssistantMessage('Recovered from CouchDB')]);
    const gate = deferred();
    fixture.options.send = vi.fn().mockImplementation(() => gate.promise);
    const first = await openDurableRuntime(fixture.options);
    runtimes.push(first);
    const pending = first.execute(createTestInput()).catch(() => undefined);
    await vi.waitFor(() => expect(fixture.options.send).toHaveBeenCalledOnce());
    const closing = first.close();
    gate.resolve();
    await closing;
    await pending;
    const head = await couchRequest(endpoint, '/pi%3Ahead');
    expect(head.ok).toBe(true);
    const send = vi.fn().mockResolvedValue(undefined);
    const second = await openDurableRuntime({
      ...fixture.options,
      storage: await openCouchDbStorage(endpoint),
      send,
    });
    runtimes.push(second);
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledExactlyOnceWith(123, 'Recovered from CouchDB'),
    );
    expect(await second.execute(createTestInput())).toBe('Recovered from CouchDB');
    expect(fixture.provider.state.callCount).toBe(1);
    expect(send).toHaveBeenCalledOnce();
  });
});
