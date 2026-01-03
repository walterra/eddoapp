/**
 * Security tab component for UserProfile
 */
import { Button, Card, Label, TextInput } from 'flowbite-react';
import { type FC } from 'react';

import type { SecurityTabProps } from './user_profile_types';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
  placeholder: string;
  hint?: string;
}

const PasswordField: FC<PasswordFieldProps> = ({
  id,
  label,
  value,
  onChange,
  isLoading,
  placeholder,
  hint,
}) => (
  <div>
    <Label htmlFor={id}>{label}</Label>
    <TextInput
      disabled={isLoading}
      id={id}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required
      type="password"
      value={value}
    />
    {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
  </div>
);

interface NewPasswordFieldsProps {
  isLoading: boolean;
  newPassword: string;
  confirmPassword: string;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
}

const NewPasswordFields: FC<NewPasswordFieldsProps> = ({
  isLoading,
  newPassword,
  confirmPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
}) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <PasswordField
      hint="Minimum 8 characters"
      id="secNewPassword"
      isLoading={isLoading}
      label="New Password"
      onChange={onNewPasswordChange}
      placeholder="Enter new password"
      value={newPassword}
    />
    <PasswordField
      id="secConfirmPassword"
      isLoading={isLoading}
      label="Confirm New Password"
      onChange={onConfirmPasswordChange}
      placeholder="Confirm new password"
      value={confirmPassword}
    />
  </div>
);

export const SecurityTab: FC<SecurityTabProps> = ({
  isLoading,
  formState,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onChangePassword,
}) => (
  <div className="space-y-6">
    <Card>
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Change Password</h2>
        <div className="space-y-4">
          <PasswordField
            id="secCurrentPassword"
            isLoading={isLoading}
            label="Current Password"
            onChange={onCurrentPasswordChange}
            placeholder="Enter your current password"
            value={formState.currentPassword}
          />
          <NewPasswordFields
            confirmPassword={formState.confirmPassword}
            isLoading={isLoading}
            newPassword={formState.newPassword}
            onConfirmPasswordChange={onConfirmPasswordChange}
            onNewPasswordChange={onNewPasswordChange}
          />
          <Button color="blue" disabled={isLoading} onClick={onChangePassword}>
            {isLoading ? 'Changing Password...' : 'Change Password'}
          </Button>
        </div>
      </div>
    </Card>
  </div>
);
