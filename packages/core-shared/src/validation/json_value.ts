import { bool, nul, str, type Schema } from '@earendil-works/pi-schema';

import { num } from './number_schema';

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}

/** Validates recursive JSON values without accepting undefined or non-finite numbers. */
export const jsonValueSchema: Schema<JsonValue> = {
  $id: 'https://eddo.app/schemas/json-value',
  anyOf: [
    str(),
    num(),
    bool(),
    nul(),
    { type: 'array', items: { $ref: '#' } },
    { type: 'object', additionalProperties: { $ref: '#' } },
  ],
};
