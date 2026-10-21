import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it } from 'vitest';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput } from './test_helpers.js';

const wrong = '---BRIEFING-START---\nDAILY BRIEFING - Sunday, October 20, 2026\nTasks';
const correct = 'DAILY BRIEFING - Tuesday, October 20, 2026';

describe('delivered report context', () => {
  it('uses the corrected delivered heading in subsequent model requests after restart', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([
      fauxAssistantMessage(wrong),
      (context) => {
        const history = JSON.stringify(context.messages);
        expect(history).toContain(correct);
        expect(history).not.toContain('Sunday, October 20');
        expect(history).not.toContain('---BRIEFING-START---');
        return fauxAssistantMessage('Tuesday');
      },
    ]);
    const input = createTestInput({
      createdAt: '2026-10-20T06:00:00Z',
      report: { type: 'briefing', occurrence: '2026-10-20' },
    });
    let runtime = await openDurableRuntime(fixture.options);
    try {
      expect(await runtime.execute(input)).toContain(correct);
      expect(await runtime.execute(input)).toContain(correct);
      const submissions = await fixture.options.storage.scanSubmissions(
        {},
        100,
        undefined,
        BACKGROUND_CONTEXT,
      );
      const original = submissions.items.find(
        (submission) => submission.requestId === input.requestId,
      );
      if (original?.type !== 'input' || original.status !== 'done')
        throw new Error('Missing original answer');
      const stored = await fixture.options.storage.entry(original.answer, BACKGROUND_CONTEXT);
      expect(JSON.stringify(stored?.entry.model)).toContain('Sunday, October 20');
      expect(
        submissions.items.filter(
          (submission) => submission.requestId === `${input.requestId}:report-context`,
        ),
      ).toHaveLength(1);
      await runtime.close();
      runtime = await openDurableRuntime(await fixture.reopen());
      expect(
        await runtime.execute(createTestInput({ requestId: 'telegram:next', text: 'Which day?' })),
      ).toBe('Tuesday');
      expect(fixture.provider.state.callCount).toBe(2);
    } finally {
      await runtime.close();
    }
  });

  it('retains a generated report in native context when delivery removes an introduction', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([
      fauxAssistantMessage('An introduction\n---RECAP-START---\nCompleted tasks'),
      (context) => {
        const history = JSON.stringify(context.messages);
        expect(history).toContain('Completed tasks');
        expect(history).not.toContain('An introduction');
        return fauxAssistantMessage('Completed tasks were reported.');
      },
    ]);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      expect(await runtime.execute(createTestInput())).toBe('Completed tasks');
      expect(await runtime.execute(createTestInput({ requestId: 'telegram:next' }))).toBe(
        'Completed tasks were reported.',
      );
    } finally {
      await runtime.close();
    }
  });
});
