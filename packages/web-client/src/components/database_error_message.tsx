import { DatabaseError, DatabaseErrorType } from '@eddo/core-client';
import React from 'react';

interface DatabaseErrorMessageProps {
  error: DatabaseError;
  onDismiss?: () => void;
  className?: string;
}

/** Inline error message component for database errors */
export function DatabaseErrorMessage({
  error,
  onDismiss,
  className = '',
}: DatabaseErrorMessageProps): React.ReactElement {
  const getErrorMessage = (error: DatabaseError): string => {
    switch (error.type) {
      case DatabaseErrorType.NETWORK_ERROR:
        return 'Network error. Changes may not be saved.';
      case DatabaseErrorType.QUOTA_EXCEEDED:
        return 'Storage full. Cannot save changes.';
      case DatabaseErrorType.SYNC_CONFLICT:
        return 'Sync conflict. Please refresh to see latest changes.';
      case DatabaseErrorType.OPERATION_FAILED:
        return `Failed to ${error.operation || 'complete operation'}. Please try again.`;
      default:
        return 'An error occurred. Please try again.';
    }
  };

  const getErrorStyles = (error: DatabaseError): string => {
    if (error.type === DatabaseErrorType.QUOTA_EXCEEDED) {
      return 'bg-red-50 border-red-200 text-red-800';
    }
    if (error.type === DatabaseErrorType.NETWORK_ERROR && error.retryable) {
      return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    }
    return 'bg-red-50 border-red-200 text-red-800';
  };

  return (
    <div
      className={`mb-4 flex items-center justify-between rounded-md border p-3 ${getErrorStyles(
        error,
      )} ${className}`}
      role="alert"
    >
      <div className="flex items-center">
        <svg
          className="mr-2 h-5 w-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            clipRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
            fillRule="evenodd"
          />
        </svg>
        <span className="text-sm font-medium">{getErrorMessage(error)}</span>
      </div>

      {onDismiss && (
        <button
          aria-label="Dismiss error"
          className="ml-4 text-current opacity-70 hover:opacity-100 focus:outline-none"
          onClick={onDismiss}
        >
          <svg
            className="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}
    </div>
  );
}
