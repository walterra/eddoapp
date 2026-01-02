import { DatabaseError, DatabaseErrorType } from '@eddo/core-client';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../test-polyfill';
import { DatabaseErrorFallback } from './database_error_fallback';

describe('DatabaseErrorFallback', () => {
  const mockOnRetry = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createError = (
    type: DatabaseErrorType,
    retryable = true,
    operation = 'test_operation',
  ): DatabaseError => ({
    name: 'DatabaseError',
    message: 'Test error',
    type,
    retryable,
    operation,
    originalError: new Error('Original error message'),
  });

  describe('Basic rendering', () => {
    it('renders the error title and warning icon', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} />);

      expect(screen.getByText('Database Error')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Warning' })).toBeInTheDocument();
    });

    it('renders in a centered card layout', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} />);

      // The card is nested - find the inner card div
      const cardElement = screen.getByText('Database Error').closest('.bg-white');
      expect(cardElement).toHaveClass('bg-white', 'shadow-lg', 'rounded-lg');
    });
  });

  describe('Error message mapping', () => {
    it('displays network error message', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} />);

      expect(
        screen.getByText(
          'Unable to connect to the database. Please check your internet connection.',
        ),
      ).toBeInTheDocument();
    });

    it('displays quota exceeded message', () => {
      const error = createError(DatabaseErrorType.QUOTA_EXCEEDED);
      render(<DatabaseErrorFallback error={error} />);

      expect(
        screen.getByText('Storage quota exceeded. Please clear some data to continue.'),
      ).toBeInTheDocument();
    });

    it('displays sync conflict message', () => {
      const error = createError(DatabaseErrorType.SYNC_CONFLICT);
      render(<DatabaseErrorFallback error={error} />);

      expect(
        screen.getByText('Data conflict detected. Your changes may need to be merged.'),
      ).toBeInTheDocument();
    });

    it('displays initialization failed message', () => {
      const error = createError(DatabaseErrorType.INITIALIZATION_FAILED);
      render(<DatabaseErrorFallback error={error} />);

      expect(
        screen.getByText('Failed to initialize the database. Please refresh the page.'),
      ).toBeInTheDocument();
    });

    it('displays permission denied message', () => {
      const error = createError(DatabaseErrorType.PERMISSION_DENIED);
      render(<DatabaseErrorFallback error={error} />);

      expect(
        screen.getByText('Permission denied. Please check your access rights.'),
      ).toBeInTheDocument();
    });

    it('displays corruption message', () => {
      const error = createError(DatabaseErrorType.CORRUPTION);
      render(<DatabaseErrorFallback error={error} />);

      expect(
        screen.getByText('Database corruption detected. Please contact support.'),
      ).toBeInTheDocument();
    });

    it('displays default message for unknown error types', () => {
      const error = createError('UNKNOWN_ERROR' as DatabaseErrorType);
      render(<DatabaseErrorFallback error={error} />);

      expect(screen.getByText('A database error occurred. Please try again.')).toBeInTheDocument();
    });
  });

  describe('Action buttons', () => {
    it('shows retry button for retryable errors when onRetry provided', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR, true);
      render(
        <DatabaseErrorFallback error={error} onDismiss={mockOnDismiss} onRetry={mockOnRetry} />,
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('does not show retry button for non-retryable errors', () => {
      const error = createError(DatabaseErrorType.CORRUPTION, false);
      render(
        <DatabaseErrorFallback error={error} onDismiss={mockOnDismiss} onRetry={mockOnRetry} />,
      );

      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });

    it('does not show retry button when onRetry not provided', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR, true);
      render(<DatabaseErrorFallback error={error} onDismiss={mockOnDismiss} />);

      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });

    it('shows cleanup button for quota exceeded errors', () => {
      const error = createError(DatabaseErrorType.QUOTA_EXCEEDED);
      render(<DatabaseErrorFallback error={error} />);

      expect(screen.getByText('Free Up Space')).toBeInTheDocument();
    });

    it('shows dismiss button when onDismiss provided', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} onDismiss={mockOnDismiss} />);

      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });

    it('does not show dismiss button when onDismiss not provided', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} />);

      expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
    });

    it('shows multiple buttons when applicable', () => {
      const error = createError(DatabaseErrorType.QUOTA_EXCEEDED, true);
      render(
        <DatabaseErrorFallback error={error} onDismiss={mockOnDismiss} onRetry={mockOnRetry} />,
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText('Free Up Space')).toBeInTheDocument();
      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });
  });

  describe('Button interactions', () => {
    it('calls onRetry when retry button is clicked', async () => {
      const user = userEvent.setup();
      const error = createError(DatabaseErrorType.NETWORK_ERROR, true);
      render(<DatabaseErrorFallback error={error} onRetry={mockOnRetry} />);

      await user.click(screen.getByText('Try Again'));
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('calls onDismiss when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} onDismiss={mockOnDismiss} />);

      await user.click(screen.getByText('Dismiss'));
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('logs cleanup request when cleanup button is clicked', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const error = createError(DatabaseErrorType.QUOTA_EXCEEDED);
      render(<DatabaseErrorFallback error={error} />);

      await user.click(screen.getByText('Free Up Space'));
      expect(consoleSpy).toHaveBeenCalledWith('Storage cleanup requested');

      consoleSpy.mockRestore();
    });
  });

  describe('Technical details in development', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('shows technical details in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} />);

      expect(screen.getByText('Technical Details')).toBeInTheDocument();
    });

    it('hides technical details in production mode', () => {
      process.env.NODE_ENV = 'production';
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} />);

      expect(screen.queryByText('Technical Details')).not.toBeInTheDocument();
    });

    it('displays error details when expanded in development', async () => {
      process.env.NODE_ENV = 'development';
      const user = userEvent.setup();
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} />);

      await user.click(screen.getByText('Technical Details'));

      // Check that some technical details are displayed
      expect(screen.getByText(/"type"/)).toBeInTheDocument();
      expect(screen.getByText(/"operation"/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} />);

      expect(screen.getByRole('heading', { name: 'Database Error' })).toBeInTheDocument();
    });

    it('has proper button accessibility', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR, true);
      render(
        <DatabaseErrorFallback error={error} onDismiss={mockOnDismiss} onRetry={mockOnRetry} />,
      );

      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    });

    it('has accessible warning icon', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} />);

      const icon = screen.getByRole('img', { name: 'Warning' });
      expect(icon).toHaveAttribute('aria-label', 'Warning');
    });
  });

  describe('Button styling', () => {
    it('applies correct styling to retry button', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR, true);
      render(<DatabaseErrorFallback error={error} onRetry={mockOnRetry} />);

      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toHaveClass(
        'bg-primary-600',
        'text-white',
        'hover:bg-primary-700',
        'focus:ring-primary-500',
      );
    });

    it('applies correct styling to cleanup button', () => {
      const error = createError(DatabaseErrorType.QUOTA_EXCEEDED);
      render(<DatabaseErrorFallback error={error} />);

      const cleanupButton = screen.getByText('Free Up Space');
      expect(cleanupButton).toHaveClass(
        'bg-neutral-200',
        'text-neutral-700',
        'hover:bg-neutral-300',
      );
    });

    it('applies correct styling to dismiss button', () => {
      const error = createError(DatabaseErrorType.NETWORK_ERROR);
      render(<DatabaseErrorFallback error={error} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByText('Dismiss');
      expect(dismissButton).toHaveClass(
        'border-neutral-300',
        'text-neutral-600',
        'hover:bg-neutral-50',
      );
    });
  });
});
