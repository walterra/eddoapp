import { Button, Card, Label, TextInput } from 'flowbite-react';
import { type FC, useState } from 'react';

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

interface FormState {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  telegramId: string;
}

/** Validate registration form fields */
function validateForm(form: FormState): string | null {
  const { username, email, password, confirmPassword, telegramId } = form;
  if (!username || !email || !password || !confirmPassword)
    return 'Please fill in all required fields';
  if (username.length < 3 || username.length > 20)
    return 'Username must be between 3 and 20 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return 'Username can only contain letters, numbers, and underscores';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (password !== confirmPassword) return 'Passwords do not match';
  if (telegramId && !/^\d+$/.test(telegramId)) return 'Telegram ID must be a valid number';
  return null;
}

const FormHeader: FC<{ isAuthenticating: boolean; onBackToLogin: () => void }> = ({
  isAuthenticating,
  onBackToLogin,
}) => (
  <div>
    <h3 className="text-xl font-medium text-gray-900">Create your Eddo App account</h3>
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
);

const ErrorMessage: FC<{ error: string }> = ({ error }) =>
  error ? <div className="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700">{error}</div> : null;

interface FieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
  hint?: string;
  required?: boolean;
}

const FormField: FC<FieldProps> = ({
  id,
  label,
  type,
  value,
  onChange,
  disabled,
  placeholder,
  hint,
  required,
}) => (
  <div>
    <Label htmlFor={id}>
      {label}
      {required && '*'}
    </Label>
    <TextInput
      disabled={disabled}
      id={id}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      type={type}
      value={value}
    />
    {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
  </div>
);

export function Register({ onRegister, isAuthenticating, onBackToLogin }: RegisterProps) {
  const [form, setForm] = useState<FormState>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    telegramId: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    const telegramIdNumber = form.telegramId ? parseInt(form.telegramId, 10) : undefined;
    const result = await onRegister(form.username, form.email, form.password, telegramIdNumber);
    if (!result.success) setError(result.error || 'Registration failed');
  };

  const update = (field: keyof FormState) => (value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <FormHeader isAuthenticating={isAuthenticating} onBackToLogin={onBackToLogin} />
          <ErrorMessage error={error} />
          <FormField
            disabled={isAuthenticating}
            hint="3-20 characters, letters, numbers, and underscores only"
            id="username"
            label="Username"
            onChange={update('username')}
            placeholder="Enter your username"
            required
            type="text"
            value={form.username}
          />
          <FormField
            disabled={isAuthenticating}
            id="email"
            label="Email"
            onChange={update('email')}
            placeholder="Enter your email"
            required
            type="email"
            value={form.email}
          />
          <FormField
            disabled={isAuthenticating}
            hint="Minimum 8 characters"
            id="password"
            label="Password"
            onChange={update('password')}
            placeholder="Enter your password"
            required
            type="password"
            value={form.password}
          />
          <FormField
            disabled={isAuthenticating}
            id="confirmPassword"
            label="Confirm Password"
            onChange={update('confirmPassword')}
            placeholder="Confirm your password"
            required
            type="password"
            value={form.confirmPassword}
          />
          <FormField
            disabled={isAuthenticating}
            hint="Optional: Link your Telegram account for bot integration"
            id="telegramId"
            label="Telegram ID (optional)"
            onChange={update('telegramId')}
            placeholder="Enter your Telegram ID"
            type="text"
            value={form.telegramId}
          />
          <Button className="w-full" color="blue" disabled={isAuthenticating} type="submit">
            {isAuthenticating ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
