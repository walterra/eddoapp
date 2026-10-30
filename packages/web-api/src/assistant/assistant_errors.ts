export type AssistantErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'request_conflict'
  | 'body_too_large'
  | 'rate_limited'
  | 'unavailable';
export type AssistantErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503;

/** Carries a public error code without forwarding service credentials or provider diagnostics. */
export class AssistantApiError extends Error {
  readonly name = 'AssistantApiError';
  constructor(
    readonly status: AssistantErrorStatus,
    readonly code: AssistantErrorCode,
  ) {
    super(code);
  }
}
