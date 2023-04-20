import { describe, expect, it } from 'vitest';

import { todos } from './__mocks__/todos';

import { getActiveRecordForTodos } from './get_active_record_for_todos';

describe('getActiveRecordForTodos', () => {
  it('gets empty active duration of a single todo without time logging', () => {
    expect(
      getActiveRecordForTodos([
        {
          ...todos[0],
          active: {},
        },
      ]),
    ).toStrictEqual({});
  });

  it('gets active duration of a single todo with time logging', () => {
    expect(getActiveRecordForTodos([todos[0]])).toStrictEqual({
      '2023-04-19T12:37:14.832Z': '2023-04-19T12:37:16.472Z',
    });
  });
  it('gets active duration of multiple todos with time logging', () => {
    expect(getActiveRecordForTodos(todos)).toStrictEqual({
      '2023-03-28T07:39:09.641Z': '2023-03-28T08:50:44.977Z',
      '2023-03-31T16:56:12.330Z': '2023-04-03T07:57:02.428Z',
      '2023-04-03T12:53:06.701Z': '2023-04-03T15:27:29.383Z',
      '2023-04-05T07:32:20.017Z': '2023-04-05T12:01:07.089Z',
      '2023-04-19T12:37:14.832Z': '2023-04-19T12:37:16.472Z',
    });
  });
});
