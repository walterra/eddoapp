import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareReply, printDurableReport } from './report_delivery.js';
import { createTestInput } from './test_helpers.js';

const mocks = vi.hoisted(() => ({ user: vi.fn(), print: vi.fn() }));
vi.mock('../utils/user-lookup.js', () => ({ lookupUserByTelegramId: mocks.user }));
vi.mock('../scheduler/helpers/printer.js', () => ({ printIfEnabled: mocks.print }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('report formatting and current printer preferences', () => {
  it('strips report markers and introductions without altering interactive text', () => {
    const input = createTestInput({ report: { type: 'recap', occurrence: '2026-10-20' } });
    expect(prepareReply(input, 'Intro\n---RECAP-START---\nDone today')).toEqual({
      answer: 'DAILY RECAP - Tuesday, October 20, 2026\n\nDone today',
      printable: true,
    });
    expect(prepareReply(input, 'No marker')).toEqual({ answer: 'No marker', printable: false });
    expect(prepareReply(createTestInput(), '---RECAP-START---\nInteractive')).toEqual({
      answer: 'Interactive',
      printable: true,
      reportType: 'recap',
    });
  });

  it('replaces an incorrect weekday even when the model omitted its marker', () => {
    const input = createTestInput({
      createdAt: '2026-10-21T01:00:00Z',
      report: { type: 'briefing', occurrence: 'user:2026-10-20:08:49' },
    });
    expect(
      prepareReply(input, 'DAILY BRIEFING - Sunday, October 20, 2026\n=====\nActual tasks'),
    ).toEqual({
      answer: 'DAILY BRIEFING - Tuesday, October 20, 2026\n\nActual tasks',
      printable: false,
    });
  });

  it('skips empty marked output instead of printing a blank report', () => {
    expect(
      prepareReply(
        createTestInput({ report: { type: 'briefing', occurrence: 'today' } }),
        '---BRIEFING-START---',
      ),
    ).toEqual({ answer: 'The report contained no content.', printable: false });
  });

  it.each(['briefing', 'recap'] as const)('reads current %s printer preferences', async (type) => {
    const input = createTestInput({ report: { type, occurrence: 'today' } });
    mocks.user.mockResolvedValue({
      _id: 'user_alice',
      username: 'alice',
      preferences: { printBriefing: false, printRecap: false },
    });
    await printDurableReport('alice', input, 'Report');
    expect(mocks.print).not.toHaveBeenCalled();
    mocks.user.mockResolvedValue({
      _id: 'user_alice',
      username: 'alice',
      preferences: { printBriefing: true, printRecap: true },
    });
    await printDurableReport('alice', input, 'Report');
    expect(mocks.print).toHaveBeenCalledWith({
      userId: 'user_alice',
      username: 'alice',
      content: 'Report',
      type,
    });
  });

  it('refuses printing for unlinked or reassigned identities', async () => {
    mocks.user.mockResolvedValue(null);
    await expect(
      printDurableReport(
        'alice',
        createTestInput({ report: { type: 'briefing', occurrence: 'today' } }),
        'Report',
      ),
    ).rejects.toThrow('identity');
    expect(mocks.print).not.toHaveBeenCalled();
  });
});
