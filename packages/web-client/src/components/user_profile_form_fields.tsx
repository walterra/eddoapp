/**
 * Form field components for UserProfile
 * Extracted from user_profile_tab_profile.tsx to reduce function size
 */
import { Label, TextInput } from 'flowbite-react';

import { formatDate } from './user_profile_types';

interface ReadOnlyFieldProps {
  id: string;
  label: string;
  value: string;
  hint?: string;
}

/** Read-only field with gray background */
export function ReadOnlyField({ id, label, value, hint }: ReadOnlyFieldProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <TextInput
        className="bg-neutral-50 dark:bg-neutral-800"
        disabled
        id={id}
        type="text"
        value={value}
      />
      {hint && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}

interface EditableEmailFieldProps {
  email: string;
  editMode: boolean;
  isLoading: boolean;
  onEmailChange: (email: string) => void;
}

/** Editable email field */
export function EditableEmailField({
  email,
  editMode,
  isLoading,
  onEmailChange,
}: EditableEmailFieldProps) {
  return (
    <div>
      <Label htmlFor="email">Email</Label>
      <TextInput
        disabled={!editMode || isLoading}
        id="email"
        onChange={(e) => onEmailChange(e.target.value)}
        required
        type="email"
        value={email}
      />
    </div>
  );
}

interface DateFieldProps {
  id: string;
  label: string;
  date: string;
}

/** Date display field */
export function DateField({ id, label, date }: DateFieldProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <TextInput
        className="bg-neutral-50 dark:bg-neutral-800"
        disabled
        id={id}
        type="text"
        value={formatDate(date)}
      />
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  hint?: string;
}

/** Password input field */
export function PasswordField({
  id,
  label,
  value,
  placeholder,
  isLoading,
  onChange,
  hint,
}: PasswordFieldProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <TextInput
        disabled={isLoading}
        id={id}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type="password"
        value={value}
      />
      {hint && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}
