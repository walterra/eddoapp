import { describe, expect, it } from 'vitest';
import { normalizeToolOutput } from './tool_output.js';

describe('bounded MCP output', () => {
  it('unwraps text blocks without double-encoding their JSON', () => {
    const payload = {
      summary: 'Briefing',
      data: { metadata: { date: '2026-10-20' }, nextActions: [] },
    };
    const result = normalizeToolOutput([{ type: 'text', text: JSON.stringify(payload) }]);
    expect(JSON.parse(result.text)).toEqual(payload);
    expect(result.isError).toBe(false);
  });

  it('retains every section and calendar metadata with huge RSS descriptions', () => {
    const items = Array.from({ length: 620 }, (_, index) => ({
      id: index,
      title: `Task ${index}`,
      description: 'rss'.repeat(2000),
    }));
    const data = {
      todaysTodos: items,
      overdueTodos: items,
      calendarToday: [{ title: 'Appointment', scheduledTime: '10:00' }],
      activeTimeTracking: [{ title: 'Active', trackedMinutes: 938 }],
      metadata: {
        date: '2026-10-20',
        weekday: 'Tuesday',
        timeZone: 'Europe/Vienna',
        counts: { overdueTodos: 620 },
      },
    };
    const output = normalizeToolOutput([{ type: 'text', text: JSON.stringify({ data }) }]);
    expect(output.text.length).toBeLessThanOrEqual(12000);
    const parsed = JSON.parse(output.text);
    expect(parsed.outputTruncation.truncated).toBe(true);
    expect(parsed.result.data.metadata).toEqual(data.metadata);
    expect(parsed.result.data.calendarToday[0].title).toBe('Appointment');
    expect(parsed.result.data.activeTimeTracking[0].trackedMinutes).toBe(938);
    expect(parsed.result.data.todaysTodos.length).toBeGreaterThan(0);
    expect(parsed.outputTruncation.omittedItems['$.data.overdueTodos']).toBeGreaterThan(0);
  });

  it('keeps plain text and multiple blocks readable', () => {
    expect(normalizeToolOutput([{ type: 'text', text: 'plain text' }]).text).toBe('plain text');
    expect(
      JSON.parse(
        normalizeToolOutput([
          { type: 'text', text: 'one' },
          { type: 'text', text: 'two' },
        ]).text,
      ),
    ).toEqual(['one', 'two']);
  });

  it('preserves application and MCP error flags', () => {
    expect(
      normalizeToolOutput([{ type: 'text', text: '{"error":"database unavailable"}' }]).isError,
    ).toBe(true);
    expect(
      normalizeToolOutput({ content: [{ type: 'text', text: 'Denied' }], isError: true }),
    ).toEqual({ text: 'Denied', isError: true });
  });

  it('bounds oversized strings as valid JSON and rejects invalid budgets', () => {
    const output = normalizeToolOutput('x'.repeat(20000));
    expect(output.text.length).toBeLessThanOrEqual(12000);
    expect(JSON.parse(output.text).outputTruncation.truncated).toBe(true);
    expect(() => normalizeToolOutput('hello', 10)).toThrow('budget');
  });
});
