import { DatabaseError, DatabaseErrorType } from '@eddo/core-client';
import React from 'react';

interface DatabaseErrorFallbackProps {
  error: DatabaseError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/** Display database errors with appropriate messaging and actions */
export function DatabaseErrorFallback({
  error,
  onRetry,
  onDismiss,
}: DatabaseErrorFallbackProps): React.ReactElement {
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

  const getActionButtons = (error: DatabaseError): React.ReactElement[] => {
    const buttons: React.ReactElement[] = [];

    if (error.retryable && onRetry) {
      buttons.push(
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          key="retry"
          onClick={onRetry}
        >
          Try Again
        </button>,
      );
    }

    if (error.type === DatabaseErrorType.QUOTA_EXCEEDED) {
      buttons.push(
        <button
          className="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          key="cleanup"
          onClick={() => {
            // TODO: Implement storage cleanup modal
            console.log('Storage cleanup requested');
          }}
        >
          Free Up Space
        </button>,
      );
    }

    if (onDismiss) {
      buttons.push(
        <button
          className="rounded border border-gray-300 px-4 py-2 text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
          key="dismiss"
          onClick={onDismiss}
        >
          Dismiss
        </button>,
      );
    }

    return buttons;
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center p-8">
      <div className="w-full rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center">
          <span aria-label="Warning" className="mr-3 text-4xl" role="img">
            ⚠️
          </span>
          <h3 className="text-xl font-semibold text-gray-900">
            Database Error
          </h3>
        </div>

        <p className="mb-6 text-gray-700">{getErrorMessage(error)}</p>

        {process.env.NODE_ENV === 'development' && error.originalError && (
          <details className="mb-6 rounded border border-gray-200 bg-gray-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-600">
              Technical Details
            </summary>
            <pre className="mt-2 overflow-x-auto text-xs text-gray-500">
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
        )}

        <div className="flex justify-end gap-3">{getActionButtons(error)}</div>
      </div>
    </div>
  );
}
