import {
  coerceNumber,
  createFieldNormalizer,
} from '@eddo/core-shared/validation/field_normalization';
import { createProjectedParser } from '@eddo/core-shared/validation/projected_parser';
import {
  map,
  num,
  obj,
  oneOf,
  opt,
  str,
  unknown as unknownSchema,
} from '@eddo/core-shared/validation/schema_parser';

/** Lists audit entries with historical numeric coercion and pagination defaults. */
export const listQuerySchema = createProjectedParser(
  obj({
    limit: num({ minimum: 1, maximum: 100 }),
    startAfter: opt(str()),
    /** Comma-separated entity identifiers. */
    entityIds: opt(str()),
    /** Comma-separated audit entry identifiers. */
    ids: opt(str()),
  }),
  {
    normalize: createFieldNormalizer({
      fields: ['limit', 'startAfter', 'entityIds', 'ids'],
      defaults: { limit: 50 },
      conversions: { limit: coerceNumber },
    }),
  },
);
export const listBySourceQuerySchema = createProjectedParser(
  obj({ limitPerSource: num({ minimum: 1, maximum: 50 }) }),
  {
    normalize: createFieldNormalizer({
      fields: ['limitPerSource'],
      defaults: { limitPerSource: 20 },
      conversions: { limitPerSource: coerceNumber },
    }),
  },
);
export const createAuditEntrySchema = createProjectedParser(
  obj({
    action: oneOf([
      'create',
      'update',
      'delete',
      'complete',
      'uncomplete',
      'time_tracking_start',
      'time_tracking_stop',
    ]),
    entityId: str(),
    before: opt(map(unknownSchema())),
    after: opt(map(unknownSchema())),
    metadata: opt(map(unknownSchema())),
  }),
);
