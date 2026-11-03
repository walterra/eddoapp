import type { StandardBoundaryParser } from '@eddo/core-shared/validation/standard_schema';
import { describe, expect, it } from 'vitest';
import {
  deleteAttachmentParameters,
  getAttachmentParameters,
  listAttachmentsParameters,
  uploadAttachmentParameters,
} from './attachment-tools';
import { createTodoParameters } from './create-todo';
import contracts from './fixtures/tool_input_contracts.json';
import { listTodosParameters } from './list-todos';
import { addNoteParameters, deleteNoteParameters, updateNoteParameters } from './note-tools';
import { searchTodosParameters } from './search-todos';
import { getServerInfoParameters } from './server-info';
import {
  getActiveTimeTrackingParameters,
  startTimeTrackingParameters,
  stopTimeTrackingParameters,
} from './time-tracking';
import { toggleCompletionParameters } from './toggle-completion';
import { updateTodoParameters } from './update-todo';

const attachments = {
  uploadAttachmentParameters,
  getAttachmentParameters,
  deleteAttachmentParameters,
  listAttachmentsParameters,
};
const create = { createTodoParameters };
const list = { listTodosParameters };
const notes = { addNoteParameters, updateNoteParameters, deleteNoteParameters };
const search = { searchTodosParameters };
const server = { getServerInfoParameters };
const time = {
  startTimeTrackingParameters,
  stopTimeTrackingParameters,
  getActiveTimeTrackingParameters,
};
const toggle = { toggleCompletionParameters };
const update = { updateTodoParameters };

const declarations: Readonly<Record<string, unknown>> = {
  ...attachments,
  ...create,
  ...list,
  ...notes,
  ...search,
  ...server,
  ...time,
  ...toggle,
  ...update,
};

function isParameter(value: unknown): value is StandardBoundaryParser<unknown> {
  return typeof value === 'object' && value !== null && '~standard' in value;
}

describe('MCP parameter migration contracts', () => {
  it.each(Object.entries(contracts))(
    'preserves serialized input schema bytes: %s',
    (name, expected) => {
      const parameter = declarations[name];
      if (!isParameter(parameter)) throw new Error(`Missing parameter: ${name}`);
      const actual = parameter['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    },
  );

  it('preserves creation defaults and returns independent mutable values', () => {
    const first = create.createTodoParameters.parse({ title: 'test', ignored: true });
    expect(first).toEqual({
      title: 'test',
      description: '',
      context: 'private',
      scheduledTime: null,
      scheduledTimeZone: null,
      tags: [],
      repeat: null,
      link: null,
      externalId: null,
      parentId: null,
    });
    expect(first.tags).not.toBe(create.createTodoParameters.parse({ title: 'test' }).tags);
    expect(create.createTodoParameters.parse({ title: '', tags: undefined }).tags).toEqual([]);
  });

  it('keeps null, missing, and empty values distinct', () => {
    expect(create.createTodoParameters.parse({ title: 'test', context: '' }).context).toBe('');
    expect(create.createTodoParameters.safeParse({ title: 'test', context: null }).success).toBe(
      false,
    );
    expect(update.updateTodoParameters.parse({ id: 'todo', blockedBy: null })).toEqual({
      id: 'todo',
      blockedBy: null,
    });
    expect(update.updateTodoParameters.safeParse({ id: 'todo', tags: null }).success).toBe(false);
  });

  it('validates custom timezones and local time strings', () => {
    expect(
      create.createTodoParameters.safeParse({ title: 'test', scheduledTimeZone: 'Mars/Unknown' })
        .success,
    ).toBe(false);
    expect(
      update.updateTodoParameters.safeParse({ id: 'todo', scheduledTime: '24:00' }).success,
    ).toBe(false);
    expect(
      update.updateTodoParameters.parse({ id: 'todo', scheduledTimeZone: null }).scheduledTimeZone,
    ).toBeNull();
  });

  it('preserves defaults without enabling implicit numeric coercion', () => {
    expect(list.listTodosParameters.parse({}).limit).toBe(50);
    expect(server.getServerInfoParameters.parse({}).section).toBe('all');
    expect(search.searchTodosParameters.parse({ query: 'test' })).toEqual({
      includeCompleted: true,
      limit: 20,
      query: 'test',
    });
    expect(search.searchTodosParameters.safeParse({ query: 'test', limit: '20' }).success).toBe(
      false,
    );
    expect(search.searchTodosParameters.safeParse({ query: '😀'.repeat(251) }).success).toBe(false);
  });

  it('rejects non-finite repeat intervals and retains metadata values', () => {
    expect(create.createTodoParameters.safeParse({ title: 'test', repeat: Infinity }).success).toBe(
      false,
    );
    expect(
      create.createTodoParameters.safeParse({ title: 'test', repeat: Number.NaN }).success,
    ).toBe(false);
    expect(
      update.updateTodoParameters.parse({
        id: 'todo',
        metadata: { labels: ['one'], custom: 'value' },
      }).metadata,
    ).toEqual({ labels: ['one'], custom: 'value' });
  });
});
