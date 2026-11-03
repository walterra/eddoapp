import {
  int as integer,
  num as number,
  type Annotations,
  type NumberBounds,
  type Schema,
} from '@earendil-works/pi-schema';

export type NumberSchemaOptions = Annotations<number> & NumberBounds;

/** Rejects non-finite JavaScript numbers at application boundaries. */
export function num(options: NumberSchemaOptions = {}): Schema<number> {
  return number({
    ...options,
    minimum: options.minimum ?? -Number.MAX_VALUE,
    maximum: options.maximum ?? Number.MAX_VALUE,
  });
}

/** Restricts integers to JavaScript's exact representation range. */
export function int(options: NumberSchemaOptions = {}): Schema<number> {
  return integer({
    ...options,
    minimum: Math.max(options.minimum ?? -Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER),
    maximum: Math.min(options.maximum ?? Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
  });
}
