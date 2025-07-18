import { Button, Card, Label, TextInput } from 'flowbite-react';
import { useState } from 'react';

interface RegisterProps {
  onRegister: (
    username: string,
    email: string,
    password: string,
    telegramId?: number,
  ) => Promise<{ success: boolean; error?: string }>;
  isAuthenticating: boolean;
  onBackToLogin: () => void;
}

export function Register({
  onRegister,
  isAuthenticating,
  onBackToLogin,
}: RegisterProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [error, setError] = useState('');

  const validateForm = (): string | null => {
    if (!username || !email || !password || !confirmPassword) {
      return 'Please fill in all required fields';
    }

    if (username.length < 3 || username.length > 20) {
      return 'Username must be between 3 and 20 characters';
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return 'Username can only contain letters, numbers, and underscores';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }

    if (telegramId && !/^\d+$/.test(telegramId)) {
      return 'Telegram ID must be a valid number';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const telegramIdNumber = telegramId ? parseInt(telegramId, 10) : undefined;
    const result = await onRegister(
      username,
      email,
      password,
      telegramIdNumber,
    );

    if (!result.success) {
      setError(result.error || 'Registration failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <h3 className="text-xl font-medium text-gray-900">
              Create your Eddo App account
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Already have an account?{' '}
              <button
                className="text-blue-600 hover:underline"
                disabled={isAuthenticating}
                onClick={onBackToLogin}
                type="button"
              >
                Sign in
              </button>
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="username">Username*</Label>
            <TextInput
              disabled={isAuthenticating}
              id="username"
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              type="text"
              value={username}
            />
            <p className="mt-1 text-xs text-gray-500">
              3-20 characters, letters, numbers, and underscores only
            </p>
          </div>

          <div>
            <Label htmlFor="email">Email*</Label>
            <TextInput
              disabled={isAuthenticating}
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              type="email"
              value={email}
            />
          </div>

          <div>
            <Label htmlFor="password">Password*</Label>
            <TextInput
              disabled={isAuthenticating}
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              type="password"
              value={password}
            />
            <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm Password*</Label>
            <TextInput
              disabled={isAuthenticating}
              id="confirmPassword"
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              type="password"
              value={confirmPassword}
            />
          </div>

          <div>
            <Label htmlFor="telegramId">Telegram ID (optional)</Label>
            <TextInput
              disabled={isAuthenticating}
              id="telegramId"
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="Enter your Telegram ID"
              type="text"
              value={telegramId}
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional: Link your Telegram account for bot integration
            </p>
          </div>

          <Button
            className="w-full"
            color="blue"
            disabled={isAuthenticating}
            type="submit"
          >
            {isAuthenticating ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
