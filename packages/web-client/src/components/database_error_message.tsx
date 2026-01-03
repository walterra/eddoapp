import { type FC } from 'react';

import { DatabaseError, DatabaseErrorType } from '@eddo/core-client';

interface DatabaseErrorMessageProps {
  error: DatabaseError;
  onDismiss?: () => void;
  className?: string;
}

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
    case DatabaseErrorType.AUTHENTICATION_EXPIRED:
      return 'Session expired. Please log in again.';
    default:
      return 'An error occurred. Please try again.';
  }
};

const getErrorStyles = (error: DatabaseError): string => {
  if (error.type === DatabaseErrorType.QUOTA_EXCEEDED) {
    return 'bg-error-50 border-error-200 text-error-800';
  }
  if (error.type === DatabaseErrorType.NETWORK_ERROR && error.retryable) {
    return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  }
  return 'bg-error-50 border-error-200 text-error-800';
};

const AlertIcon: FC = () => (
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
);

const DismissButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    aria-label="Dismiss error"
    className="ml-4 text-current opacity-70 hover:opacity-100 focus:outline-none"
    onClick={onClick}
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
);

export const DatabaseErrorMessage: FC<DatabaseErrorMessageProps> = ({
  error,
  onDismiss,
  className = '',
}) => (
  <div
    className={`mb-4 flex items-center justify-between rounded-lg border p-3 ${getErrorStyles(error)} ${className}`}
    role="alert"
  >
    <div className="flex items-center">
      <AlertIcon />
      <span className="text-sm font-medium">{getErrorMessage(error)}</span>
    </div>
    {onDismiss && <DismissButton onClick={onDismiss} />}
  </div>
);
