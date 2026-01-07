import isNil from 'lodash-es/isNil';

import { type TodoAlpha2 } from './todo_alpha2';

type UnknownObject = Record<string, unknown> | { [key: string]: unknown };

export interface TodoAlpha3 extends Omit<TodoAlpha2, 'version'> {
  externalId?: string | null;
  link: string | null;
  parentId?: string | null;
  version: 'alpha3';
}

export function isTodoAlpha3(arg: unknown): arg is TodoAlpha3 {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'version' in arg &&
    (arg as UnknownObject).version === 'alpha3'
  );
}

export function migrateToAlpha3(arg: TodoAlpha2): TodoAlpha3 {
  return {
    ...arg,
    externalId: null,
    link: null,
    version: 'alpha3',
  };
}
