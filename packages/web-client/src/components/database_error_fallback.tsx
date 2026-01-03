import { type FC } from 'react';

import { DatabaseError, DatabaseErrorType } from '@eddo/core-client';

import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, CARD_BASE } from '../styles/interactive';

interface DatabaseErrorFallbackProps {
  error: DatabaseError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const getErrorMessage = (error: DatabaseError): string => {
  switch (error.type) {
    case DatabaseErrorType.NETWORK_ERROR:
      return 'Unable to connect to the database. Please check your internet connection.';
    case DatabaseErrorType.QUOTA_EXCEEDED:
      return 'Storage quota exceeded. Please clear some data to continue.';
    case DatabaseErrorType.SYNC_CONFLICT:
      return 'Data conflict detected. Your changes may need to be merged.';
    case DatabaseErrorType.INITIALIZATION_FAILED:
      return 'Failed to initialize the database. Please refresh the page.';
    case DatabaseErrorType.PERMISSION_DENIED:
      return 'Permission denied. Please check your access rights.';
    case DatabaseErrorType.CORRUPTION:
      return 'Database corruption detected. Please contact support.';
    default:
      return 'A database error occurred. Please try again.';
  }
};

interface ActionButtonsProps {
  error: DatabaseError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const ActionButtons: FC<ActionButtonsProps> = ({ error, onRetry, onDismiss }) => (
  <div className="flex justify-end gap-3">
    {error.retryable && onRetry && (
      <button className={BTN_PRIMARY} onClick={onRetry}>
        Try Again
      </button>
    )}
    {error.type === DatabaseErrorType.QUOTA_EXCEEDED && (
      <button className={BTN_SECONDARY} onClick={() => console.log('Storage cleanup requested')}>
        Free Up Space
      </button>
    )}
    {onDismiss && (
      <button className={BTN_GHOST} onClick={onDismiss}>
        Dismiss
      </button>
    )}
  </div>
);

interface TechnicalDetailsProps {
  error: DatabaseError;
}

const TechnicalDetails: FC<TechnicalDetailsProps> = ({ error }) => {
  if (process.env.NODE_ENV !== 'development' || !error.originalError) return null;

  return (
    <details className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
      <summary className="cursor-pointer text-sm font-medium text-neutral-600">
        Technical Details
      </summary>
      <pre className="mt-2 overflow-x-auto text-xs text-neutral-500">
        {JSON.stringify(
          {
            type: error.type,
            operation: error.operation,
            document: error.document,
            retryable: error.retryable,
            message: error.originalError.message,
            stack: error.originalError.stack,
          },
          null,
          2,
        )}
      </pre>
    </details>
  );
};

export const DatabaseErrorFallback: FC<DatabaseErrorFallbackProps> = ({
  error,
  onRetry,
  onDismiss,
}) => (
  <div className="mx-auto flex max-w-md flex-col items-center justify-center p-8">
    <div className={`w-full p-6 shadow-lg ${CARD_BASE}`}>
      <div className="mb-4 flex items-center">
        <span aria-label="Warning" className="mr-3 text-4xl" role="img">
          ⚠️
        </span>
        <h3 className="text-xl font-semibold text-neutral-900">Database Error</h3>
      </div>
      <p className="mb-6 text-neutral-700">{getErrorMessage(error)}</p>
      <TechnicalDetails error={error} />
      <ActionButtons error={error} onDismiss={onDismiss} onRetry={onRetry} />
    </div>
  </div>
);
