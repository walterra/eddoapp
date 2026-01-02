import { Button, Card, Checkbox, Label, TextInput } from 'flowbite-react';
import { type FC, useState } from 'react';

interface LoginProps {
  onLogin: (username: string, password: string, rememberMe: boolean) => Promise<boolean>;
  isAuthenticating: boolean;
  onGoToRegister: () => void;
}

interface FormHeaderProps {
  isAuthenticating: boolean;
  onGoToRegister: () => void;
}

const FormHeader: FC<FormHeaderProps> = ({ isAuthenticating, onGoToRegister }) => (
  <div>
    <h3 className="text-xl font-medium text-neutral-900">Sign in to Eddo App</h3>
    <p className="mt-1 text-sm text-neutral-600">
      Don&apos;t have an account?{' '}
      <button
        className="text-primary-600 hover:underline"
        disabled={isAuthenticating}
        onClick={onGoToRegister}
        type="button"
      >
        Create account
      </button>
    </p>
  </div>
);

const ErrorMessage: FC<{ error: string }> = ({ error }) =>
  error ? (
    <div className="bg-error-100 text-error-700 mb-4 rounded-lg p-4 text-sm">{error}</div>
  ) : null;

interface LoginFieldsProps {
  username: string;
  password: string;
  rememberMe: boolean;
  isAuthenticating: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (value: boolean) => void;
}

const LoginFields: FC<LoginFieldsProps> = ({
  username,
  password,
  rememberMe,
  isAuthenticating,
  onUsernameChange,
  onPasswordChange,
  onRememberMeChange,
}) => (
  <>
    <div>
      <Label htmlFor="username">Username</Label>
      <TextInput
        disabled={isAuthenticating}
        id="username"
        onChange={(e) => onUsernameChange(e.target.value)}
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
        onChange={(e) => onPasswordChange(e.target.value)}
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
        onChange={(e) => onRememberMeChange(e.target.checked)}
      />
      <Label htmlFor="rememberMe">Remember me</Label>
    </div>
  </>
);

export const Login: FC<LoginProps> = ({ onLogin, isAuthenticating, onGoToRegister }) => {
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
    if (!success) setError('Invalid credentials');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <Card className="w-full max-w-md">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <FormHeader isAuthenticating={isAuthenticating} onGoToRegister={onGoToRegister} />
          <ErrorMessage error={error} />
          <LoginFields
            isAuthenticating={isAuthenticating}
            onPasswordChange={setPassword}
            onRememberMeChange={setRememberMe}
            onUsernameChange={setUsername}
            password={password}
            rememberMe={rememberMe}
            username={username}
          />
          <Button className="w-full" color="blue" disabled={isAuthenticating} type="submit">
            {isAuthenticating ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
