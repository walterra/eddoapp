import type { AssistantRequestStatus } from '@eddo/core-shared';
import { z } from 'zod';

export const MAX_INTERNAL_BODY_BYTES = 32_768;
const username = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_.-]+$/);

export const internalAdmissionSchema = z
  .object({
    username,
    requestId: z.uuid(),
    text: z.string().trim().min(1).max(8_000),
  })
  .strict();
export const internalStatusSchema = z
  .object({
    username,
    requestId: z.string().min(1).max(256),
  })
  .strict();

export type InternalAdmission = z.infer<typeof internalAdmissionSchema>;
export type InternalStatusQuery = z.infer<typeof internalStatusSchema>;
export type InternalErrorCode = 'forbidden' | 'unavailable' | 'request_conflict';

export interface InternalAssistantOperations {
  admit: (input: InternalAdmission) => Promise<AssistantRequestStatus>;
  status: (input: InternalStatusQuery) => Promise<AssistantRequestStatus | null>;
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
