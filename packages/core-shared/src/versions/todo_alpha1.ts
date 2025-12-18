import isNil from 'lodash-es/isNil';

export interface TodoAlpha1 {
  _id: string;
  _rev: string;
  completed: boolean;
  context: string;
  title: string;
}

export function isTodoAlpha1(arg: unknown): arg is TodoAlpha1 {
  return (
    typeof arg === 'object' && !isNil(arg) && !Object.prototype.hasOwnProperty.call(arg, 'version')
  );
}
