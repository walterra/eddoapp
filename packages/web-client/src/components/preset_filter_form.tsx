/**
 * Save preset form component
 */
import { type FC, useState } from 'react';

import { BTN_PRIMARY_SM, CLEAR_BUTTON, INPUT_BASE } from '../styles/interactive';

import type { SavePresetFormProps } from './preset_filter_types';

interface FormInputProps {
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
}

const FormInput: FC<FormInputProps> = ({ value, onChange, isLoading }) => (
  <div>
    <label
      className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400"
      htmlFor="preset-name"
    >
      Preset name
    </label>
    <input
      autoFocus
      className={`w-full ${INPUT_BASE}`}
      disabled={isLoading}
      id="preset-name"
      onChange={(e) => onChange(e.target.value)}
      placeholder="e.g., Today's tasks"
      type="text"
      value={value}
    />
  </div>
);

interface DateCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  isLoading: boolean;
}

const DateCheckbox: FC<DateCheckboxProps> = ({ checked, onChange, isLoading }) => (
  <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
    <input
      checked={checked}
      className="text-primary-600 focus:ring-primary-500 rounded border-neutral-300"
      disabled={isLoading}
      onChange={(e) => onChange(e.target.checked)}
      type="checkbox"
    />
    Always use current date
  </label>
);

export const SavePresetForm: FC<SavePresetFormProps> = ({ onSave, onCancel, isLoading }) => {
  const [name, setName] = useState('');
  const [useRelativeDate, setUseRelativeDate] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave(name.trim(), useRelativeDate);
  };

  return (
    <form
      className="space-y-3 border-t border-neutral-200 pt-3 dark:border-neutral-600"
      onSubmit={handleSubmit}
    >
      <FormInput isLoading={isLoading} onChange={setName} value={name} />
      <DateCheckbox checked={useRelativeDate} isLoading={isLoading} onChange={setUseRelativeDate} />
      <div className="flex gap-2">
        <button className={BTN_PRIMARY_SM} disabled={!name.trim() || isLoading} type="submit">
          {isLoading ? 'Saving...' : 'Save'}
        </button>
        <button className={CLEAR_BUTTON} disabled={isLoading} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
};
