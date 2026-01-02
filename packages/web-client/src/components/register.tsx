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

const initialFormState: FormState = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  telegramId: '',
};

const isUsernameValid = (username: string): boolean =>
  username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);

const isEmailValid = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isTelegramIdValid = (telegramId: string): boolean => !telegramId || /^\d+$/.test(telegramId);

const validateForm = (form: FormState): string | null => {
  const { username, email, password, confirmPassword, telegramId } = form;
  if (!username || !email || !password || !confirmPassword)
    return 'Please fill in all required fields';
  if (!isUsernameValid(username))
    return 'Username must be 3-20 characters, letters, numbers, and underscores only';
  if (!isEmailValid(email)) return 'Please enter a valid email address';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (password !== confirmPassword) return 'Passwords do not match';
  if (!isTelegramIdValid(telegramId)) return 'Telegram ID must be a valid number';
  return null;
};

interface FormHeaderProps {
  isAuthenticating: boolean;
  onBackToLogin: () => void;
}

const FormHeader: FC<FormHeaderProps> = ({ isAuthenticating, onBackToLogin }) => (
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

interface FieldConfig {
  id: keyof FormState;
  label: string;
  type: string;
  placeholder: string;
  hint?: string;
  required?: boolean;
}

const fieldConfigs: FieldConfig[] = [
  {
    id: 'username',
    label: 'Username',
    type: 'text',
    placeholder: 'Enter your username',
    hint: '3-20 characters, letters, numbers, and underscores only',
    required: true,
  },
  { id: 'email', label: 'Email', type: 'email', placeholder: 'Enter your email', required: true },
  {
    id: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    hint: 'Minimum 8 characters',
    required: true,
  },
  {
    id: 'confirmPassword',
    label: 'Confirm Password',
    type: 'password',
    placeholder: 'Confirm your password',
    required: true,
  },
  {
    id: 'telegramId',
    label: 'Telegram ID (optional)',
    type: 'text',
    placeholder: 'Enter your Telegram ID',
    hint: 'Optional: Link your Telegram account for bot integration',
  },
];

interface FormFieldProps {
  config: FieldConfig;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

const FormField: FC<FormFieldProps> = ({ config, value, onChange, disabled }) => (
  <div>
    <Label htmlFor={config.id}>
      {config.label}
      {config.required && '*'}
    </Label>
    <TextInput
      disabled={disabled}
      id={config.id}
      onChange={(e) => onChange(e.target.value)}
      placeholder={config.placeholder}
      required={config.required}
      type={config.type}
      value={value}
    />
    {config.hint && <p className="mt-1 text-xs text-gray-500">{config.hint}</p>}
  </div>
);

interface RegisterFieldsProps {
  form: FormState;
  isAuthenticating: boolean;
  update: (field: keyof FormState) => (value: string) => void;
}

const RegisterFields: FC<RegisterFieldsProps> = ({ form, isAuthenticating, update }) => (
  <>
    {fieldConfigs.map((config) => (
      <FormField
        config={config}
        disabled={isAuthenticating}
        key={config.id}
        onChange={update(config.id)}
        value={form[config.id]}
      />
    ))}
  </>
);

export const Register: FC<RegisterProps> = ({ onRegister, isAuthenticating, onBackToLogin }) => {
  const [form, setForm] = useState<FormState>(initialFormState);
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
          <RegisterFields form={form} isAuthenticating={isAuthenticating} update={update} />
          <Button className="w-full" color="blue" disabled={isAuthenticating} type="submit">
            {isAuthenticating ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
