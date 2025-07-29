/** Types of database errors that can occur */
export enum DatabaseErrorType {
  INITIALIZATION_FAILED = 'initialization_failed',
  OPERATION_FAILED = 'operation_failed',
  QUOTA_EXCEEDED = 'quota_exceeded',
  NETWORK_ERROR = 'network_error',
  SYNC_CONFLICT = 'sync_conflict',
  CORRUPTION = 'corruption',
  PERMISSION_DENIED = 'permission_denied',
  AUTHENTICATION_EXPIRED = 'authentication_expired',
}

/** Extended error interface for database operations */
export interface DatabaseError extends Error {
  type: DatabaseErrorType;
  originalError?: Error;
  operation?: string;
  document?: string;
  retryable: boolean;
}

/** Database operation error with additional context */
export class DatabaseOperationError extends Error implements DatabaseError {
  type: DatabaseErrorType;
  originalError?: Error;
  operation?: string;
  document?: string;
  retryable: boolean;

  constructor(
    type: DatabaseErrorType,
    message: string,
    options: {
      originalError?: Error;
      operation?: string;
      document?: string;
      retryable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'DatabaseOperationError';
    this.type = type;
    this.originalError = options.originalError;
    this.operation = options.operation;
    this.document = options.document;
    this.retryable = options.retryable ?? false;
  }
}
