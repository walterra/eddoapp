import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import type { DurableRuntime } from '@eddo/assistant-server/runtime';
import { CouchDBContainer, type StartedCouchDBContainer } from '@testcontainers/couchdb';
import { randomUUID } from 'node:crypto';
import { openCouchDbStorage } from 'pi-durable-couchdb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { couchRequest, type CouchEndpoint } from '../../durable/couch.js';
import { openDurableRuntime } from '../../durable/runtime.js';
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
  it('persists shared report context and deduplicates report delivery/printing after reopen', async () => {
    const fixture = await createRuntimeFixture();
    await fixture.options.storage.close(
      (await import('@earendil-works/chord/context')).BACKGROUND_CONTEXT,
    );
    fixture.options.storage = await openCouchDbStorage(endpoint);
    fixture.options.print = vi.fn().mockResolvedValue(undefined);
    fixture.provider.setResponses([
      fauxAssistantMessage('Prioritize the API migration this week.'),
      (context) => {
        expect(JSON.stringify(context.messages)).toContain('Prioritize the API migration');
        return fauxAssistantMessage('---BRIEFING-START---\nAPI migration is the priority.');
      },
    ]);
    const runtime = await openDurableRuntime(fixture.options);
    runtimes.push(runtime);
    await runtime.execute(createTestInput({ requestId: 'telegram:report-context' }));
    const report = createTestInput({
      requestId: 'report:briefing:2026-10-20:07:00',
      report: { type: 'briefing', occurrence: '2026-10-20:07:00' },
      text: 'Generate the scheduled briefing using our discussion.',
    });
    await runtime.enqueue(report);
    expect(await runtime.execute(report)).toBe(
      'DAILY BRIEFING - Tuesday, October 20, 2026\n\nAPI migration is the priority.',
    );
    await runtime.close();
    const recovered = await openDurableRuntime({
      ...fixture.options,
      storage: await openCouchDbStorage(endpoint),
    });
    runtimes.push(recovered);
    expect(await recovered.execute({ ...report, conversationId: 'new-after-report' })).toBe(
      'DAILY BRIEFING - Tuesday, October 20, 2026\n\nAPI migration is the priority.',
    );
    expect(fixture.provider.state.callCount).toBe(2);
    expect(fixture.options.print).toHaveBeenCalledOnce();
    expect(fixture.options.send).toHaveBeenCalledTimes(2);
    await recovered.close();
  });

  it('persists corrected model-facing report text in published CouchDB history', async () => {
    const fixture = await createRuntimeFixture();
    await fixture.options.storage.close(
      (await import('@earendil-works/chord/context')).BACKGROUND_CONTEXT,
    );
    fixture.options.storage = await openCouchDbStorage(endpoint);
    fixture.provider.setResponses([
      fauxAssistantMessage(
        '---BRIEFING-START---\nDAILY BRIEFING - Sunday, October 20, 2026\nTasks',
      ),
      (context) => {
        const history = JSON.stringify(context.messages);
        expect(history).toContain('DAILY BRIEFING - Tuesday, October 20, 2026');
        expect(history).not.toContain('Sunday, October 20');
        return fauxAssistantMessage('Tuesday');
      },
    ]);
    const report = createTestInput({
      requestId: 'report:corrected',
      conversationId: 'report-corrected',
      report: { type: 'briefing', occurrence: '2026-10-20' },
    });
    const first = await openDurableRuntime(fixture.options);
    runtimes.push(first);
    expect(await first.execute(report)).toContain('Tuesday, October 20');
    await first.close();
    const second = await openDurableRuntime({
      ...fixture.options,
      storage: await openCouchDbStorage(endpoint),
    });
    runtimes.push(second);
    expect(
      await second.execute(
        createTestInput({
          requestId: 'telegram:corrected-followup',
          conversationId: report.conversationId,
        }),
      ),
    ).toBe('Tuesday');
    await second.close();
  });

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
