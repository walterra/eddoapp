import type { TodoAlpha4 } from '@eddo/core-server';
import { CouchDBContainer, type StartedCouchDBContainer } from '@testcontainers/couchdb';
import nano from 'nano';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getTimezoneDateRange } from '../../tools/date-range.js';
import { executeGetBriefingData } from '../../tools/get-briefing-data.js';
import { executeGetRecapData } from '../../tools/get-recap-data.js';
import type { ToolContext } from '../../tools/types.js';

let container: StartedCouchDBContainer | undefined;
let database: nano.DocumentScope<TodoAlpha4>;
const now = new Date();
const range = getTimezoneDateRange(now, 'Europe/Vienna');
const context = {
  session: { timezone: 'Europe/Vienna' },
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
} as unknown as ToolContext;

function todo(id: string, changes: Partial<TodoAlpha4> = {}): TodoAlpha4 {
  return {
    _id: id,
    version: 'alpha4',
    title: id,
    context: 'work',
    due: range.todayDate,
    completed: null,
    tags: ['gtd:next'],
    active: {},
    description: 'large rss description '.repeat(200),
    link: null,
    repeat: null,
    ...changes,
  };
}

beforeAll(async () => {
  const password = randomUUID();
  container = await new CouchDBContainer('couchdb:3.5.0')
    .withUsername('admin')
    .withPassword(password)
    .start();
  const connection = nano(
    `http://admin:${password}@${container.getHost()}:${container.getMappedPort(5984)}`,
  );
  const name = `report_test_${randomUUID().replaceAll('-', '')}`;
  await connection.db.create(name);
  database = connection.db.use<TodoAlpha4>(name);
  await database.createIndex({
    index: { fields: ['version', 'completed', 'due'] },
    name: 'version-completed-due-index',
    ddoc: 'version-completed-due-index',
  });
  await connection.db.use(name).insert({
    _id: '_design/todos_by_time_tracking_active',
    views: {
      byTimeTrackingActive: {
        map: "function(doc){if(doc.version==='alpha4'&&doc.active){for(var s in doc.active){if(doc.active[s]===null)emit(doc._id,null);}}}",
      },
    },
  });
  const docs = [
    ...Array.from({ length: 620 }, (_, index) =>
      todo(`rss-${index}`, { due: '2003-07-27', tags: ['gtd:someday', 'source:rss'] }),
    ),
    ...Array.from({ length: 25 }, (_, index) =>
      todo(`overdue-${index}`, {
        due: new Date(Date.parse(`${range.todayDate}T12:00:00Z`) - (index + 1) * 86_400_000)
          .toISOString()
          .slice(0, 10),
        link: 'https://example.com/proposal',
        parentId: 'project',
        blockedBy: ['dependency'],
      }),
    ),
    ...Array.from({ length: 20 }, (_, index) => todo(`today-${index}`)),
    todo('calendar-late', { tags: ['gtd:calendar'], scheduledTime: '16:00' }),
    todo('calendar-early', { tags: ['gtd:calendar'], scheduledTime: '09:00' }),
    todo('active', {
      tags: [],
      active: { [new Date(now.getTime() - 3_600_000).toISOString()]: null },
    }),
    todo('completed', { completed: now.toISOString() }),
  ];
  const response = await database.bulk({ docs });
  expect(response.every((item) => !('error' in item))).toBe(true);
}, 120_000);
afterAll(async () => {
  if (container) await container.stop();
});

describe('compact report queries against real CouchDB', () => {
  it('separates a large RSS backlog and retains exact counts and every important section', async () => {
    const response = JSON.parse(await executeGetBriefingData({}, context, () => database));
    expect(response.error).toBeUndefined();
    expect(response.data.metadata.counts).toMatchObject({
      somedayBacklog: 620,
      todaysTodos: 21,
      overdueTodos: 25,
      nextActions: 45,
      calendarToday: 2,
      activeTimeTracking: 1,
    });
    expect(response.data.metadata.selection.somedayBacklog).toMatchObject({
      countExact: true,
      returned: 0,
    });
    expect(response.data.overdueTodos).toHaveLength(10);
    expect(response.data.overdueTodos[0]).toMatchObject({
      id: 'overdue-0',
      _id: 'overdue-0',
      link: 'https://example.com/proposal',
      parentId: 'project',
      blockedBy: ['dependency'],
    });
    expect(response.data.metadata).toMatchObject({
      contractVersion: 2,
      itemsAreCompleteTodos: false,
      detailTool: 'getTodo',
    });
    expect(
      response.data.calendarToday.map((item: { scheduledTime: string }) => item.scheduledTime),
    ).toEqual(['09:00', '16:00']);
    expect(response.data.activeTimeTracking[0].trackedMinutes).toBeGreaterThanOrEqual(60);
    expect(JSON.stringify(response)).not.toContain('large rss description');
    expect(JSON.stringify(response).length).toBeLessThan(12_000);
  });

  it('uses the completion index and compact time-tracking summaries for recaps', async () => {
    const response = JSON.parse(await executeGetRecapData({}, context, () => database));
    expect(response.error).toBeUndefined();
    expect(response.data.metadata.counts).toMatchObject({
      completedToday: 1,
      upcomingNextActions: 45,
      activeTimeTracking: 1,
    });
    expect(response.data.completedToday[0].id).toBe('completed');
    expect(response.data.upcomingNextActions).toHaveLength(10);
    expect(response.data.metadata.timeZone).toBe('Europe/Vienna');
  });
});
