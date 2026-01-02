/**
 * Error display component for TodoEditModal
 */
import { type DatabaseError, DatabaseErrorType } from '@eddo/core-client';
import { type FC } from 'react';

interface ErrorDisplayProps {
  error: DatabaseError;
  onClear: () => void;
}

export const ErrorDisplay: FC<ErrorDisplayProps> = ({ error, onClear }) => (
  <div className="border-error-200 bg-error-50 dark:border-error-700 dark:bg-error-900 mb-4 rounded-md border px-4 py-3">
    <div className="flex items-start">
      <div className="flex-shrink-0">
        <ErrorIcon />
      </div>
      <div className="ml-3 flex-1">
        <p className="text-error-700 dark:text-error-200 text-sm">
          {error.type === DatabaseErrorType.SYNC_CONFLICT
            ? 'This todo was modified by another device. Please close and try again.'
            : error.message}
        </p>
      </div>
      <div className="ml-auto pl-3">
        <button
          className="text-error-400 hover:text-error-500 inline-flex"
          onClick={onClear}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  </div>
);

function ErrorIcon() {
  return (
    <svg className="text-error-400 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}
