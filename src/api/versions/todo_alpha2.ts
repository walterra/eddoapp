import isNil from 'lodash-es/isNil';

import { type TodoAlpha1 } from './todo_alpha1';

type UnknownObject = Record<string, unknown> | { [key: string]: unknown };

export interface TodoAlpha2 {
  // Date ISO string of creation
  _id: string;
  _rev: string;
  // Record to track activity: key = begin date ISO string, value = end date ISO string or null if currently running
  active: Record<string, string | null>;
  // Done = completion date ISO string, Not done = null
  completed: string | null;
  // GTD like context, use to split board columns
  context: string;
  description: string;
  // Due date as ISO string, should default to end of day of day created
  due: string;
  // Wether the todo should be set up to be repeated on completion in x days; disabled = null
  repeat: number | null;
  // Tags on the task level
  tags: string[];
  title: string;
  version: 'alpha2';
}

export function isTodoAlpha2(arg: unknown): arg is TodoAlpha2 {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'version' in arg &&
    (arg as UnknownObject).version === 'alpha2'
  );
}

export function migrateToAlpha2(arg: TodoAlpha1): TodoAlpha2 {
  return {
    _id: arg._id,
    _rev: arg._rev,
    active: {},
    completed: arg.completed ? new Date().toISOString() : null,
    context: arg.context ?? 'private',
    description: '',
    due: `${arg._id.split('T')[0]}T23:59:59.999Z`,
    repeat: null,
    tags: [],
    title: arg.title,
    version: 'alpha2',
  };
}
