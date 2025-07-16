import { DatabaseError, DatabaseErrorType } from '@eddo/core-client';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../test-polyfill';
import { DatabaseErrorMessage } from './database_error_message';

describe('DatabaseErrorMessage', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createError = (
    type: DatabaseErrorType,
    retryable = true,
    operation = 'save',
  ): DatabaseError => ({
    name: 'DatabaseError',
    message: 'Test error',
    type,
    retryable,
    operation,
    originalError: new Error('Original error message'),
  });

  describe('Basic rendering', () => {
    it('renders as an alert role', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('renders with default classes', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(
        'mb-4',
        'flex',
        'items-center',
        'justify-between',
      );
    });

    it('applies custom className when provided', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage className="custom-class" error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-class');
    });

    it('displays error icon', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} />);

      // Check for the SVG warning icon
      const icon = screen.getByRole('alert').querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-5', 'w-5');
    });
  });

  describe('Error message mapping', () => {
    it('displays network error message', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} />);

      expect(
        screen.getByText('Network error. Changes may not be saved.'),
      ).toBeInTheDocument();
    });

    it('displays quota exceeded message', () => {
      const error = createError(DatabaseErrorType.QUOTA_EXCEEDED);
      render(<DatabaseErrorMessage error={error} />);

      expect(
        screen.getByText('Storage full. Cannot save changes.'),
      ).toBeInTheDocument();
    });

    it('displays sync conflict message', () => {
      const error = createError(DatabaseErrorType.SYNC_CONFLICT);
      render(<DatabaseErrorMessage error={error} />);

      expect(
        screen.getByText(
          'Sync conflict. Please refresh to see latest changes.',
        ),
      ).toBeInTheDocument();
    });

    it('displays operation failed message with operation', () => {
      const error = createError(
        DatabaseErrorType.OPERATION_FAILED,
        true,
        'delete',
      );
      render(<DatabaseErrorMessage error={error} />);

      expect(
        screen.getByText('Failed to delete. Please try again.'),
      ).toBeInTheDocument();
    });

    it('displays operation failed message without operation', () => {
      const error: DatabaseError = {
        name: 'DatabaseError',
        message: 'Test error',
        type: DatabaseErrorType.OPERATION_FAILED,
        retryable: true,
        operation: undefined,
        originalError: new Error('Original error'),
      };
      render(<DatabaseErrorMessage error={error} />);

      expect(
        screen.getByText('Failed to complete operation. Please try again.'),
      ).toBeInTheDocument();
    });

    it('displays default message for unknown error types', () => {
      const error = createError('UNKNOWN_ERROR' as DatabaseErrorType);
      render(<DatabaseErrorMessage error={error} />);

      expect(
        screen.getByText('An error occurred. Please try again.'),
      ).toBeInTheDocument();
    });
  });

  describe('Error styling based on type', () => {
    it('applies red styling for quota exceeded errors', () => {
      const error = createError(DatabaseErrorType.QUOTA_EXCEEDED);
      render(<DatabaseErrorMessage error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800');
    });

    it('applies yellow styling for retryable network errors', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR, true);
      render(<DatabaseErrorMessage error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(
        'bg-yellow-50',
        'border-yellow-200',
        'text-yellow-800',
      );
    });

    it('applies red styling for non-retryable network errors', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR, false);
      render(<DatabaseErrorMessage error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800');
    });

    it('applies red styling for other error types', () => {
      const error = createError(DatabaseErrorType.CORRUPTION);
      render(<DatabaseErrorMessage error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800');
    });
  });

  describe('Dismiss functionality', () => {
    it('shows dismiss button when onDismiss provided', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByRole('button', {
        name: 'Dismiss error',
      });
      expect(dismissButton).toBeInTheDocument();
    });

    it('does not show dismiss button when onDismiss not provided', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls onDismiss when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByRole('button', {
        name: 'Dismiss error',
      });
      await user.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('applies correct styling to dismiss button', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByRole('button', {
        name: 'Dismiss error',
      });
      expect(dismissButton).toHaveClass(
        'ml-4',
        'text-current',
        'opacity-70',
        'hover:opacity-100',
        'focus:outline-none',
      );
    });

    it('contains close icon in dismiss button', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByRole('button', {
        name: 'Dismiss error',
      });
      const icon = dismissButton.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-4', 'w-4');
    });
  });

  describe('Accessibility', () => {
    it('has proper alert role', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('has accessible dismiss button when provided', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByRole('button', {
        name: 'Dismiss error',
      });
      expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss error');
    });

    it('has proper text hierarchy', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} />);

      const text = screen.getByText('Network error. Changes may not be saved.');
      expect(text).toHaveClass('text-sm', 'font-medium');
    });
  });

  describe('Layout and structure', () => {
    it('has correct container layout', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(
        'mb-4',
        'flex',
        'items-center',
        'justify-between',
        'rounded-md',
        'border',
        'p-3',
      );
    });

    it('has correct text and icon layout', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} />);

      const textContainer = screen.getByText(
        'Network error. Changes may not be saved.',
      ).parentElement;
      expect(textContainer).toHaveClass('flex', 'items-center');
    });

    it('shows both icon and text content', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorMessage error={error} />);

      const alert = screen.getByRole('alert');
      const icon = alert.querySelector('svg');
      const text = screen.getByText('Network error. Changes may not be saved.');

      expect(icon).toBeInTheDocument();
      expect(text).toBeInTheDocument();
    });
  });

  describe('Error type coverage', () => {
    it('handles all defined error types with appropriate messages', () => {
      const errorTypes = [
        DatabaseErrorType.NETWORK_ERROR,
        DatabaseErrorType.QUOTA_EXCEEDED,
        DatabaseErrorType.SYNC_CONFLICT,
        DatabaseErrorType.OPERATION_FAILED,
      ];

      errorTypes.forEach((type) => {
        const error = createError(type);
        const { unmount } = render(<DatabaseErrorMessage error={error} />);

        // Verify that some error message is displayed (not empty)
        const alert = screen.getByRole('alert');
        const textElement = alert.querySelector('.text-sm');
        expect(textElement).toHaveTextContent(/\S/); // Non-whitespace content

        unmount();
      });
    });
  });
});
