import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it, vi } from 'vitest';
import { isDeliveredRequestFailure } from './request_failure.js';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput } from './test_helpers.js';

const failed = () =>
  fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'Invalid request' });

function report() {
  return createTestInput({ report: { type: 'briefing', occurrence: '2026-10-20' } });
}

describe('native generation failure outcomes', () => {
  it('fails interactive execution after delivering one notice without regenerating on duplicate updates', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([failed()]);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      for (let index = 0; index < 2; index += 1) {
        await expect(runtime.execute(createTestInput())).rejects.toMatchObject({
          answerDelivered: true,
        });
      }
      expect(fixture.provider.state.callCount).toBe(1);
      expect(fixture.options.send).toHaveBeenCalledTimes(1);
      expect(fixture.options.project).toHaveBeenCalledTimes(1);
    } finally {
      await runtime.close();
    }
  });

  it('retries read-only reports before delivery and prints only the successful report', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.reportRetryDelayMs = 0;
    fixture.options.print = vi.fn();
    fixture.provider.setResponses([
      failed(),
      fauxAssistantMessage('---BRIEFING-START---\nRecovered report'),
    ]);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      expect(await runtime.execute(report())).toContain('Recovered report');
      expect(fixture.provider.state.callCount).toBe(2);
      expect(fixture.options.send).toHaveBeenCalledTimes(1);
      expect(fixture.options.print).toHaveBeenCalledTimes(1);
    } finally {
      await runtime.close();
    }
  });

  it('caps report retries and retains the failed outcome after delivering its notice', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.reportRetryDelayMs = 0;
    fixture.options.print = vi.fn();
    fixture.provider.setResponses([failed(), failed(), failed()]);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      await expect(runtime.execute(report())).rejects.toMatchObject({ answerDelivered: true });
      expect(fixture.provider.state.callCount).toBe(3);
      expect(fixture.options.send).toHaveBeenCalledTimes(1);
      expect(fixture.options.print).not.toHaveBeenCalled();
    } finally {
      await runtime.close();
    }
  });

  it('resumes pending report backoff after restart without replaying the failed attempt', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.reportRetryDelayMs = 200;
    fixture.provider.setResponses([
      failed(),
      fauxAssistantMessage('---BRIEFING-START---\nAfter restart'),
    ]);
    let runtime = await openDurableRuntime(fixture.options);
    try {
      await runtime.enqueue(report());
      await vi.waitFor(() => expect(fixture.options.onReport).toHaveBeenCalled(), { interval: 1 });
      await runtime.close();
      runtime = await openDurableRuntime(await fixture.reopen());
      expect(await runtime.execute(report())).toContain('After restart');
      expect(fixture.provider.state.callCount).toBe(2);
      expect(fixture.options.send).toHaveBeenCalledTimes(1);
    } finally {
      await runtime.close();
    }
  });

  it('does not schedule a retry beyond the report deadline', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.reportRetryDelayMs = 60_000;
    fixture.provider.setResponses([failed()]);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      await expect(
        runtime.execute({ ...report(), deadline: Date.now() + 1000 }),
      ).rejects.toMatchObject({ answerDelivered: true });
      expect(fixture.provider.state.callCount).toBe(1);
      expect(fixture.options.send).toHaveBeenCalledTimes(1);
    } finally {
      await runtime.close();
    }
  });

  it('does not confuse ordinary errors with already delivered failure notices', () => {
    expect(isDeliveredRequestFailure(new Error('Connection failed'))).toBe(false);
    expect(
      isDeliveredRequestFailure({ name: 'DeliveredRequestFailure', answerDelivered: true }),
    ).toBe(false);
  });
});
