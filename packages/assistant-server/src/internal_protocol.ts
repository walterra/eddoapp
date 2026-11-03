import type { AssistantPendingRequests, AssistantRequestStatus } from '@eddo/core-shared';
import { uuidSchema, validateTextLength } from '@eddo/core-shared/validation/compatibility';
import {
  createSchemaParser,
  obj,
  str,
  type Static,
} from '@eddo/core-shared/validation/schema_parser';

export const MAX_INTERNAL_BODY_BYTES = 32_768;
const username = str({ minLength: 1, maxLength: 128, pattern: '^[a-zA-Z0-9_.-]+$' });
const admission = obj({
  username,
  requestId: uuidSchema(),
  text: str({ minLength: 1, maxLength: 8_000 }),
});

/** Trims admission text before applying its length bounds. */
function normalizeAdmission(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  if (!Object.hasOwn(value, 'text')) return value;
  const text: unknown = Reflect.get(value, 'text');
  return typeof text === 'string' ? { ...value, text: text.trim() } : value;
}

export const internalAdmissionSchema = createSchemaParser(admission, {
  normalize: normalizeAdmission,
  validate: (value) => validateTextLength(value.text, 8_000, '/text'),
});
export const internalStatusSchema = createSchemaParser(
  obj({ username, requestId: str({ minLength: 1, maxLength: 256 }) }),
  { validate: (value) => validateTextLength(value.requestId, 256, '/requestId') },
);
export const internalPendingSchema = createSchemaParser(obj({ username }));
export type InternalPendingQuery = Static<typeof internalPendingSchema.schema>;
export type InternalAdmission = Static<typeof admission>;
export type InternalStatusQuery = Static<typeof internalStatusSchema.schema>;
export type InternalErrorCode = 'forbidden' | 'unavailable' | 'request_conflict';

export interface InternalAssistantOperations {
  pending: (input: InternalPendingQuery) => Promise<AssistantPendingRequests>;
  admit: (input: InternalAdmission) => Promise<AssistantRequestStatus>;
  status: (input: InternalStatusQuery) => Promise<AssistantRequestStatus | null>;
  cancel: (input: InternalStatusQuery) => Promise<AssistantRequestStatus>;
}

/** Carries a bounded service error without forwarding provider or infrastructure diagnostics. */
export class InternalAssistantError extends Error {
  readonly name = 'InternalAssistantError';
  constructor(
    readonly status: 403 | 409 | 503,
    readonly code: InternalErrorCode,
  ) {
    super(code);
  }
}
