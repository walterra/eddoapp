import { Button, Card, Checkbox, Label, TextInput } from 'flowbite-react';
import { useState } from 'react';

interface LoginProps {
  onLogin: (username: string, password: string, rememberMe: boolean) => Promise<boolean>;
  isAuthenticating: boolean;
  onGoToRegister: () => void;
}

export function Login({ onLogin, isAuthenticating, onGoToRegister }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    const success = await onLogin(username, password, rememberMe);
    if (!success) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <h3 className="text-xl font-medium text-gray-900">Sign in to Eddo App</h3>
            <p className="mt-1 text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <button
                className="text-blue-600 hover:underline"
                disabled={isAuthenticating}
                onClick={onGoToRegister}
                type="button"
              >
                Create account
              </button>
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700">{error}</div>
          )}

          <div>
            <Label htmlFor="username">Username</Label>
            <TextInput
              disabled={isAuthenticating}
              id="username"
              onChange={(e) => setUsername(e.target.value)}
              required
              type="text"
              value={username}
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <TextInput
              disabled={isAuthenticating}
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={rememberMe}
              disabled={isAuthenticating}
              id="rememberMe"
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <Label htmlFor="rememberMe">Remember me</Label>
          </div>

          <Button className="w-full" color="blue" disabled={isAuthenticating} type="submit">
            {isAuthenticating ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
