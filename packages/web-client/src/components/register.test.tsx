import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Register } from './register';

describe('Register Component', () => {
  const mockRegister = vi.fn();
  const mockBackToLogin = vi.fn();

  const defaultProps = {
    onRegister: mockRegister,
    isAuthenticating: false,
    onBackToLogin: mockBackToLogin,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('renders registration form with all fields', () => {
      render(<Register {...defaultProps} />);

      expect(screen.getByText('Create your Eddo App account')).toBeInTheDocument();
      expect(screen.getByLabelText('Username*')).toBeInTheDocument();
      expect(screen.getByLabelText('Email*')).toBeInTheDocument();
      expect(screen.getByLabelText('Password*')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password*')).toBeInTheDocument();
      expect(screen.getByLabelText('Telegram ID (optional)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    });

    it('renders back to login link', () => {
      render(<Register {...defaultProps} />);

      expect(screen.getByText('Already have an account?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });

    it('shows helper text for form fields', () => {
      render(<Register {...defaultProps} />);

      expect(
        screen.getByText('3-20 characters, letters, numbers, and underscores only'),
      ).toBeInTheDocument();
      expect(screen.getByText('Minimum 8 characters')).toBeInTheDocument();
      expect(
        screen.getByText('Optional: Link your Telegram account for bot integration'),
      ).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('handles username input correctly', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      const usernameInput = screen.getByLabelText('Username*');
      await user.type(usernameInput, 'testuser');

      expect(usernameInput).toHaveValue('testuser');
    });

    it('handles email input correctly', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      const emailInput = screen.getByLabelText('Email*');
      await user.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('handles password input correctly', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      const passwordInput = screen.getByLabelText('Password*');
      await user.type(passwordInput, 'testpassword123');

      expect(passwordInput).toHaveValue('testpassword123');
    });

    it('handles confirm password input correctly', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      const confirmPasswordInput = screen.getByLabelText('Confirm Password*');
      await user.type(confirmPasswordInput, 'testpassword123');

      expect(confirmPasswordInput).toHaveValue('testpassword123');
    });

    it('handles telegram ID input correctly', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      const telegramIdInput = screen.getByLabelText('Telegram ID (optional)');
      await user.type(telegramIdInput, '123456789');

      expect(telegramIdInput).toHaveValue('123456789');
    });

    it('calls onBackToLogin when sign in link is clicked', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      const signInLink = screen.getByRole('button', { name: 'Sign in' });
      await user.click(signInLink);

      expect(mockBackToLogin).toHaveBeenCalledTimes(1);
    });
  });

  describe('Form Validation', () => {
    it('shows error when required fields are empty', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      // Remove required attributes to test validation logic
      const usernameInput = screen.getByLabelText('Username*');
      const emailInput = screen.getByLabelText('Email*');
      const passwordInput = screen.getByLabelText('Password*');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password*');

      usernameInput.removeAttribute('required');
      emailInput.removeAttribute('required');
      passwordInput.removeAttribute('required');
      confirmPasswordInput.removeAttribute('required');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows error when username is too short', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'ab');
      await user.type(screen.getByLabelText('Email*'), 'test@example.com');
      await user.type(screen.getByLabelText('Password*'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password*'), 'password123');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      expect(
        screen.getByText(
          'Username must be 3-20 characters, letters, numbers, and underscores only',
        ),
      ).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows error when username is too long', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'a'.repeat(21));
      await user.type(screen.getByLabelText('Email*'), 'test@example.com');
      await user.type(screen.getByLabelText('Password*'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password*'), 'password123');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      expect(
        screen.getByText(
          'Username must be 3-20 characters, letters, numbers, and underscores only',
        ),
      ).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows error when username contains invalid characters', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'test-user');
      await user.type(screen.getByLabelText('Email*'), 'test@example.com');
      await user.type(screen.getByLabelText('Password*'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password*'), 'password123');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      expect(
        screen.getByText(
          'Username must be 3-20 characters, letters, numbers, and underscores only',
        ),
      ).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows error when email is invalid', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'testuser');
      await user.type(screen.getByLabelText('Email*'), 'invalid-email');
      await user.type(screen.getByLabelText('Password*'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password*'), 'password123');

      const emailInput = screen.getByLabelText('Email*') as HTMLInputElement;

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });

      await user.click(submitButton);

      // If HTML5 validation prevents submission, check that our handler wasn't called
      // If HTML5 validation allows it through, check that our custom validation caught it
      try {
        await waitFor(() => {
          expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
        });
        // Our custom validation caught it
      } catch {
        // HTML5 validation might have prevented submission
        // Check that the email input is invalid according to HTML5
        expect(emailInput.validity.valid).toBe(false);
        expect(emailInput.validity.typeMismatch).toBe(true);
      }

      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows error when password is too short', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'testuser');
      await user.type(screen.getByLabelText('Email*'), 'test@example.com');
      await user.type(screen.getByLabelText('Password*'), 'short');
      await user.type(screen.getByLabelText('Confirm Password*'), 'short');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      expect(screen.getByText('Password must be at least 8 characters long')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'testuser');
      await user.type(screen.getByLabelText('Email*'), 'test@example.com');
      await user.type(screen.getByLabelText('Password*'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password*'), 'differentpassword');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows error when telegram ID is not a number', async () => {
      const user = userEvent.setup();
      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'testuser');
      await user.type(screen.getByLabelText('Email*'), 'test@example.com');
      await user.type(screen.getByLabelText('Password*'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password*'), 'password123');
      await user.type(screen.getByLabelText('Telegram ID (optional)'), 'notanumber');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      expect(screen.getByText('Telegram ID must be a valid number')).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data without telegram ID', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({ success: true });

      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'testuser');
      await user.type(screen.getByLabelText('Email*'), 'test@example.com');
      await user.type(screen.getByLabelText('Password*'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password*'), 'password123');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith(
          'testuser',
          'test@example.com',
          'password123',
          undefined,
        );
      });
    });

    it('submits form with valid data including telegram ID', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({ success: true });

      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'testuser');
      await user.type(screen.getByLabelText('Email*'), 'test@example.com');
      await user.type(screen.getByLabelText('Password*'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password*'), 'password123');
      await user.type(screen.getByLabelText('Telegram ID (optional)'), '123456789');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith(
          'testuser',
          'test@example.com',
          'password123',
          123456789,
        );
      });
    });

    it('shows server error when registration fails', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({
        success: false,
        error: 'Username already exists',
      });

      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'testuser');
      await user.type(screen.getByLabelText('Email*'), 'test@example.com');
      await user.type(screen.getByLabelText('Password*'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password*'), 'password123');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Username already exists')).toBeInTheDocument();
      });
    });

    it('shows generic error when registration fails without specific error', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({ success: false });

      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'testuser');
      await user.type(screen.getByLabelText('Email*'), 'test@example.com');
      await user.type(screen.getByLabelText('Password*'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password*'), 'password123');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Registration failed')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('disables form elements when authenticating', () => {
      render(<Register {...defaultProps} isAuthenticating={true} />);

      expect(screen.getByLabelText('Username*')).toBeDisabled();
      expect(screen.getByLabelText('Email*')).toBeDisabled();
      expect(screen.getByLabelText('Password*')).toBeDisabled();
      expect(screen.getByLabelText('Confirm Password*')).toBeDisabled();
      expect(screen.getByLabelText('Telegram ID (optional)')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    });

    it('shows "Creating account..." text when authenticating', () => {
      render(<Register {...defaultProps} isAuthenticating={true} />);

      expect(screen.getByRole('button', { name: 'Creating account...' })).toBeInTheDocument();
    });

    it('shows "Create account" text when not authenticating', () => {
      render(<Register {...defaultProps} isAuthenticating={false} />);

      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('clears error message when form is resubmitted', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({
        success: false,
        error: 'Username already exists',
      });

      render(<Register {...defaultProps} />);

      await user.type(screen.getByLabelText('Username*'), 'testuser');
      await user.type(screen.getByLabelText('Email*'), 'test@example.com');
      await user.type(screen.getByLabelText('Password*'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password*'), 'password123');

      const submitButton = screen.getByRole('button', {
        name: 'Create account',
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Username already exists')).toBeInTheDocument();
      });

      mockRegister.mockResolvedValue({ success: true });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Username already exists')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and structure', () => {
      render(<Register {...defaultProps} />);

      expect(screen.getByLabelText('Username*')).toBeInTheDocument();
      expect(screen.getByLabelText('Email*')).toBeInTheDocument();
      expect(screen.getByLabelText('Password*')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password*')).toBeInTheDocument();
      expect(screen.getByLabelText('Telegram ID (optional)')).toBeInTheDocument();
    });

    it('has proper button types', () => {
      render(<Register {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Create account' })).toHaveAttribute(
        'type',
        'submit',
      );
      expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'button');
    });
  });
});
