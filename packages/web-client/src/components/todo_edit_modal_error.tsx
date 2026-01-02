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
  <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-700 dark:bg-red-900">
    <div className="flex items-start">
      <div className="flex-shrink-0">
        <ErrorIcon />
      </div>
      <div className="ml-3 flex-1">
        <p className="text-sm text-red-700 dark:text-red-200">
          {error.type === DatabaseErrorType.SYNC_CONFLICT
            ? 'This todo was modified by another device. Please close and try again.'
            : error.message}
        </p>
      </div>
      <div className="ml-auto pl-3">
        <button
          className="inline-flex text-red-400 hover:text-red-500"
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
    <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
