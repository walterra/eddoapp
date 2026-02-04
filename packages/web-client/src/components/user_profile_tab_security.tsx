/**
 * Security tab component for UserProfile
 */
import { Button, Card, Label, TextInput } from 'flowbite-react';
import { type FC, useState } from 'react';
import { BiCheck, BiSolidCopyAlt } from 'react-icons/bi';

import { formatDate, type SecurityTabProps } from './user_profile_types';

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

type PasswordFormState = SecurityTabProps['formState'];

interface ChangePasswordCardProps {
  formState: PasswordFormState;
  isLoading: boolean;
  onChangePassword: () => Promise<void>;
  onConfirmPasswordChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
}

const ChangePasswordCard: FC<ChangePasswordCardProps> = ({
  formState,
  isLoading,
  onChangePassword,
  onConfirmPasswordChange,
  onCurrentPasswordChange,
  onNewPasswordChange,
}) => (
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
);

interface McpApiKeyCardProps {
  isLoading: boolean;
  mcpApiKey?: string | null;
  mcpApiKeySetAt?: string;
  onGenerateMcpApiKey: () => Promise<void>;
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy method
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
};

const CopyKeyButton: FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(value);
    if (!success) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      className={
        copied
          ? 'text-green-500'
          : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
      }
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy API key'}
      type="button"
    >
      {copied ? <BiCheck size="1.1em" /> : <BiSolidCopyAlt size="1.1em" />}
    </button>
  );
};

const McpApiKeyCard: FC<McpApiKeyCardProps> = ({
  isLoading,
  mcpApiKey,
  mcpApiKeySetAt,
  onGenerateMcpApiKey,
}) => (
  <Card>
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">MCP API Key</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Use this key in MCP clients to authenticate requests.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mcpApiKey">API Key</Label>
        {mcpApiKey ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-700/60 bg-neutral-900/40 px-3 py-2">
            <code className="truncate font-mono text-sm text-neutral-100">{mcpApiKey}</code>
            <CopyKeyButton value={mcpApiKey} />
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-700/60 bg-neutral-900/40 px-3 py-2 text-sm text-neutral-400">
            {mcpApiKeySetAt ? 'API key hidden. Generate to rotate.' : 'No API key generated'}
          </div>
        )}
        <div className="text-xs text-neutral-500">
          {mcpApiKey
            ? 'This key is shown once. Store it securely now.'
            : 'Generating a new key invalidates the old one.'}
        </div>
      </div>
      <div className="flex flex-col gap-2 text-xs text-neutral-500">
        {mcpApiKeySetAt && <span>Created {formatDate(mcpApiKeySetAt)}</span>}
        <div>
          <Button color="blue" disabled={isLoading} onClick={onGenerateMcpApiKey}>
            {mcpApiKeySetAt || mcpApiKey ? 'Rotate API Key' : 'Generate API Key'}
          </Button>
        </div>
      </div>
    </div>
  </Card>
);

export const SecurityTab: FC<SecurityTabProps> = ({
  isLoading,
  formState,
  mcpApiKey,
  mcpApiKeySetAt,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onChangePassword,
  onGenerateMcpApiKey,
}) => (
  <div className="space-y-6">
    <ChangePasswordCard
      formState={formState}
      isLoading={isLoading}
      onChangePassword={onChangePassword}
      onConfirmPasswordChange={onConfirmPasswordChange}
      onCurrentPasswordChange={onCurrentPasswordChange}
      onNewPasswordChange={onNewPasswordChange}
    />
    <McpApiKeyCard
      isLoading={isLoading}
      mcpApiKey={mcpApiKey}
      mcpApiKeySetAt={mcpApiKeySetAt}
      onGenerateMcpApiKey={onGenerateMcpApiKey}
    />
  </div>
);
