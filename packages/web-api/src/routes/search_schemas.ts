import { validateTextLength } from '@eddo/core-shared/validation/compatibility';
import { createFieldNormalizer } from '@eddo/core-shared/validation/field_normalization';
import {
  arr,
  bool,
  createSchemaParser,
  int,
  obj,
  oneOf,
  opt,
  str,
} from '@eddo/core-shared/validation/schema_parser';

export const searchTodosSchema = createSchemaParser(
  obj({
    context: opt(str()),
    includeCompleted: bool(),
    limit: int({ minimum: 1, maximum: 100 }),
    query: str({ minLength: 1, maxLength: 500 }),
    tags: opt(arr(str())),
  }),
  {
    normalize: createFieldNormalizer({
      fields: ['context', 'includeCompleted', 'limit', 'query', 'tags'],
      defaults: { includeCompleted: true, limit: 20 },
    }),
    validate: (value) => validateTextLength(value.query, 500, '/query'),
  },
);
export const searchAuditSchema = createSchemaParser(
  obj({
    action: opt(
      oneOf([
        'create',
        'update',
        'delete',
        'complete',
        'uncomplete',
        'time_tracking_start',
        'time_tracking_stop',
      ]),
    ),
    entityId: opt(str()),
    fromDate: opt(str()),
    limit: int({ minimum: 1, maximum: 100 }),
    query: opt(str()),
    source: opt(oneOf(['web', 'mcp', 'telegram', 'github-sync', 'rss-sync', 'email-sync'])),
    toDate: opt(str()),
  }),
  {
    normalize: createFieldNormalizer({
      fields: ['action', 'entityId', 'fromDate', 'limit', 'query', 'source', 'toDate'],
      defaults: { limit: 50 },
    }),
  },
);
export const suggestSchema = createSchemaParser(
  obj({
    field: oneOf(['title', 'context', 'tags']),
    limit: int({ minimum: 1, maximum: 20 }),
    prefix: str({ minLength: 1, maxLength: 100 }),
  }),
  {
    normalize: createFieldNormalizer({
      fields: ['field', 'limit', 'prefix'],
      defaults: { field: 'title', limit: 10 },
    }),
    validate: (value) => validateTextLength(value.prefix, 100, '/prefix'),
  },
);
export type SearchAuditParams = ReturnType<typeof searchAuditSchema.parse>;
export type SuggestParams = ReturnType<typeof suggestSchema.parse>;
