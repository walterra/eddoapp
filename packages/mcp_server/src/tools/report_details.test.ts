import type { TodoAlpha4 } from '@eddo/core-server';
import { describe, expect, it, vi } from 'vitest';
import { queryReportSection, reportItem } from './report_payload.js';
import type { GetUserDb } from './types.js';

function todo(changes: Partial<TodoAlpha4> = {}): TodoAlpha4 {
  return {
    _id: '2026-10-20T00:00:00.000Z',
    version: 'alpha4',
    title: 'Review proposal',
    context: 'work',
    due: '2026-10-20',
    completed: null,
    active: {},
    description: 'Private long description',
    repeat: null,
    tags: ['gtd:next'],
    link: 'https://example.com/proposal',
    parentId: 'parent-task',
    blockedBy: ['dependency'],
    ...changes,
  };
}

describe('bounded report detail compatibility', () => {
  it('preserves the legacy ID alias, actionable links, and dependency references', () => {
    expect(reportItem(todo(), Date.now())).toMatchObject({
      id: '2026-10-20T00:00:00.000Z',
      _id: '2026-10-20T00:00:00.000Z',
      link: 'https://example.com/proposal',
      parentId: 'parent-task',
      blockedBy: ['dependency'],
      fieldsTruncated: false,
    });
  });

  it('omits oversized links and relationship IDs instead of returning broken identifiers', () => {
    const item = reportItem(
      todo({
        link: `https://example.com/${'x'.repeat(1000)}`,
        parentId: 'x'.repeat(1000),
        blockedBy: [
          'x'.repeat(1000),
          ...Array.from({ length: 10 }, (_, index) => `dependency-${index}`),
        ],
      }),
      Date.now(),
    );
    expect(item.link).toBeNull();
    expect(item.parentId).toBeNull();
    expect(item.blockedBy).toHaveLength(5);
    expect(item.blockedBy).not.toContain('x'.repeat(80));
    expect(item.fieldsTruncated).toBe(true);
  });

  it('retains actionability tags even after many ordinary tags', () => {
    expect(
      reportItem(todo({ tags: ['a', 'b', 'c', 'd', 'e', 'f', 'gtd:blocked'] }), Date.now()).tags,
    ).toContain('gtd:blocked');
  });

  it('requests useful detail fields without restoring unbounded descriptions or metadata', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [todo()] });
    await queryReportSection(
      { find } as unknown as ReturnType<GetUserDb>,
      {
        name: 'nextActions',
        query: { selector: {} },
        limit: 10,
      },
      Date.now(),
    );
    const query = find.mock.calls[0][0];
    expect(query.fields).toEqual(expect.arrayContaining(['_id', 'link', 'parentId', 'blockedBy']));
    expect(query.fields).not.toContain('description');
    expect(query.fields).not.toContain('metadata');
  });
});
