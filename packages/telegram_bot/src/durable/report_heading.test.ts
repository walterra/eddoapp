import {
  inputReportHeading,
  renderReportHeading,
  reportHeading,
} from '@eddo/assistant-server/report_heading';
import { describe, expect, it } from 'vitest';
import { createTestInput } from './test_helpers.js';

describe('deterministic report calendar facts', () => {
  it('computes Tuesday instead of relying on an LLM date association', () => {
    expect(reportHeading('briefing', '2026-10-20')).toBe(
      'DAILY BRIEFING - Tuesday, October 20, 2026',
    );
    expect(reportHeading('recap', '2024-02-29')).toBe('DAILY RECAP - Thursday, February 29, 2024');
  });

  it('uses the local occurrence date across UTC midnight and ignores dates in user IDs', () => {
    const input = createTestInput({
      createdAt: '2026-10-21T01:00:00Z',
      report: { type: 'briefing', occurrence: 'user_2020-01-01:2026-10-20:23:30' },
    });
    expect(inputReportHeading(input)).toBe('DAILY BRIEFING - Tuesday, October 20, 2026');
  });

  it('replaces an incorrect model heading without losing the body', () => {
    const input = createTestInput({ report: { type: 'briefing', occurrence: '2026-10-20' } });
    expect(
      renderReportHeading(input, 'DAILY BRIEFING - Sunday, October 20, 2026\n=====\n* Actual task'),
    ).toBe('DAILY BRIEFING - Tuesday, October 20, 2026\n\n* Actual task');
  });
});
