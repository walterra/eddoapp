import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Login } from './login';

describe('Login Component', () => {
  const mockOnLogin = vi.fn();
  const mockOnGoToRegister = vi.fn();

  const defaultProps = {
    onLogin: mockOnLogin,
    isAuthenticating: false,
    onGoToRegister: mockOnGoToRegister,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnLogin.mockResolvedValue(true);
  });

  it('renders login form with all fields', () => {
    render(<Login {...defaultProps} />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders remember me checkbox unchecked by default', () => {
    render(<Login {...defaultProps} />);

    const checkbox = screen.getByLabelText(/remember me/i);
    expect(checkbox).not.toBeChecked();
  });

  it('allows toggling remember me checkbox', () => {
    render(<Login {...defaultProps} />);

    const checkbox = screen.getByLabelText(/remember me/i);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('calls onLogin with rememberMe=false when checkbox is unchecked', async () => {
    render(<Login {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith('testuser', 'password123', false);
    });
  });

  it('calls onLogin with rememberMe=true when checkbox is checked', async () => {
    render(<Login {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByLabelText(/remember me/i));
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith('testuser', 'password123', true);
    });
  });

  it('disables all inputs while authenticating', () => {
    render(<Login {...defaultProps} isAuthenticating={true} />);

    expect(screen.getByLabelText(/username/i)).toBeDisabled();
    expect(screen.getByLabelText(/password/i)).toBeDisabled();
    expect(screen.getByLabelText(/remember me/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  it('shows error when login fails', async () => {
    mockOnLogin.mockResolvedValue(false);
    render(<Login {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('does not call onLogin when form is submitted with empty fields', async () => {
    render(<Login {...defaultProps} />);

    // Form has 'required' attributes, so submission should be blocked
    // In jsdom, we test that onLogin is not called
    const form = screen.getByRole('button', { name: /sign in/i }).closest('form');
    expect(form).toBeInTheDocument();

    // Clicking submit with empty required fields should not call onLogin
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Give time for any async operations
    await waitFor(() => {
      expect(mockOnLogin).not.toHaveBeenCalled();
    });
  });

  it('navigates to register when link is clicked', () => {
    render(<Login {...defaultProps} />);

    fireEvent.click(screen.getByText(/create account/i));

    expect(mockOnGoToRegister).toHaveBeenCalled();
  });
});
