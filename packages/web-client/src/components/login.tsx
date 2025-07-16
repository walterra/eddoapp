import { Button, Card, Label, TextInput } from 'flowbite-react';
import { useState } from 'react';

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  isAuthenticating: boolean;
}

export function Login({ onLogin, isAuthenticating }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    const success = await onLogin(username, password);
    if (!success) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <h3 className="text-xl font-medium text-gray-900">
            Sign in to Eddo App
          </h3>

          {error && (
            <div className="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700">
              {error}
            </div>
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

          <Button
            className="w-full"
            color="blue"
            disabled={isAuthenticating}
            type="submit"
          >
            {isAuthenticating ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
