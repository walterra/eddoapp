/**
 * Email integration section for UserProfile
 */
import { Button, Label, TextInput } from 'flowbite-react';
import { type FC } from 'react';

import { ToggleSwitch } from './toggle_switch';
import { formatDate, SYNC_INTERVAL_OPTIONS } from './user_profile_types';

export interface EmailFormState {
  emailSync: boolean;
  emailFolder: string;
  emailSyncInterval: number;
  emailSyncTags: string;
}

export interface EmailSectionProps {
  isLoading: boolean;
  isResyncing: boolean;
  isConnected: boolean;
  connectedEmail?: string;
  lastSync?: string;
  emailState: EmailFormState;
  onEmailSyncChange: (enabled: boolean) => void;
  onEmailFolderChange: (folder: string) => void;
  onEmailIntervalChange: (interval: number) => void;
  onEmailTagsChange: (tags: string) => void;
  onSaveEmail: () => Promise<void>;
  onForceResync: () => Promise<void>;
  onConnectGmail: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

const EmailHeader: FC = () => (
  <div>
    <h3 className="font-medium text-neutral-900 dark:text-white">Email to Todo Sync</h3>
    <p className="text-sm text-neutral-600 dark:text-neutral-400">
      Automatically sync emails from a designated folder as todos. Create a folder/label called
      &quot;Eddo&quot; in your email client and emails there will become todos.
    </p>
  </div>
);

interface EmailConnectionStatusProps {
  isConnected: boolean;
  connectedEmail?: string;
  isLoading: boolean;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

/**
 * Mask email for display (show first 3 chars and domain)
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 3 ? local.substring(0, 3) + '***' : '***';
  return `${maskedLocal}@${domain}`;
}

const EmailConnectionStatus: FC<EmailConnectionStatusProps> = ({
  isConnected,
  connectedEmail,
  isLoading,
  onConnect,
  onDisconnect,
}) => (
  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
    <div className="flex items-center justify-between">
      <div>
        <Label>Gmail Account</Label>
        {isConnected && connectedEmail ? (
          <p className="text-sm text-green-600 dark:text-green-400">
            ✓ Connected: {maskEmail(connectedEmail)}
          </p>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Not connected</p>
        )}
      </div>
      {isConnected ? (
        <Button color="red" disabled={isLoading} onClick={onDisconnect} size="sm">
          Disconnect
        </Button>
      ) : (
        <Button color="blue" disabled={isLoading} onClick={onConnect} size="sm">
          Connect Gmail
        </Button>
      )}
    </div>
    {!isConnected && (
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Click &quot;Connect Gmail&quot; to authorize Eddo to read emails from your designated
        folder. We only access the folder you specify (default: &quot;Eddo&quot;).
      </p>
    )}
  </div>
);

interface EmailSyncToggleProps {
  checked: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}

const EmailSyncToggle: FC<EmailSyncToggleProps> = ({ checked, disabled, onChange }) => (
  <div className="flex items-center justify-between">
    <div>
      <Label>Enable Email Sync</Label>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Sync emails from your folder to todos
      </p>
    </div>
    <ToggleSwitch checked={checked} disabled={disabled} onChange={onChange} />
  </div>
);

interface EmailFolderInputProps {
  disabled: boolean;
  value: string;
  onChange: (folder: string) => void;
}

const EmailFolderInput: FC<EmailFolderInputProps> = ({ disabled, value, onChange }) => (
  <div>
    <Label htmlFor="emailFolder">Email Folder / Label</Label>
    <TextInput
      disabled={disabled}
      id="emailFolder"
      onChange={(e) => onChange(e.target.value)}
      placeholder="Eddo"
      type="text"
      value={value}
    />
    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      The IMAP folder or Gmail label to sync from. Create this folder/label in your email client.
    </p>
  </div>
);

interface EmailIntervalSelectProps {
  disabled: boolean;
  value: number;
  onChange: (interval: number) => void;
}

const EmailIntervalSelect: FC<EmailIntervalSelectProps> = ({ disabled, value, onChange }) => (
  <div>
    <Label htmlFor="emailSyncInterval">Sync Interval</Label>
    <select
      className="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
      disabled={disabled}
      id="emailSyncInterval"
      onChange={(e) => onChange(Number(e.target.value))}
      value={value}
    >
      {SYNC_INTERVAL_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      How often to check for new emails in your folder
    </p>
  </div>
);

interface EmailTagsInputProps {
  disabled: boolean;
  value: string;
  onChange: (tags: string) => void;
}

const EmailTagsInput: FC<EmailTagsInputProps> = ({ disabled, value, onChange }) => (
  <div>
    <Label htmlFor="emailSyncTags">Tags</Label>
    <TextInput
      disabled={disabled}
      id="emailSyncTags"
      onChange={(e) => onChange(e.target.value)}
      placeholder="source:email, gtd:next"
      type="text"
      value={value}
    />
    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      Comma-separated tags to add to synced todos
    </p>
  </div>
);

interface EmailActionsProps {
  isLoading: boolean;
  isResyncing: boolean;
  syncEnabled: boolean;
  isConnected: boolean;
  onForceResync: () => Promise<void>;
  onSaveEmail: () => Promise<void>;
}

const EmailActions: FC<EmailActionsProps> = ({
  isLoading,
  isResyncing,
  syncEnabled,
  isConnected,
  onForceResync,
  onSaveEmail,
}) => (
  <div className="flex justify-between gap-4 border-t pt-4">
    <Button
      color="gray"
      disabled={isResyncing || !syncEnabled || !isConnected}
      onClick={onForceResync}
    >
      {isResyncing ? 'Resyncing...' : 'Force Resync'}
    </Button>
    <Button color="blue" disabled={isLoading} onClick={onSaveEmail}>
      {isLoading ? 'Saving...' : 'Save Email Settings'}
    </Button>
  </div>
);

interface EmailSettingsProps {
  emailState: EmailFormState;
  isDisabled: boolean;
  onEmailSyncChange: (enabled: boolean) => void;
  onEmailFolderChange: (folder: string) => void;
  onEmailIntervalChange: (interval: number) => void;
  onEmailTagsChange: (tags: string) => void;
}

const EmailSettings: FC<EmailSettingsProps> = ({
  emailState,
  isDisabled,
  onEmailSyncChange,
  onEmailFolderChange,
  onEmailIntervalChange,
  onEmailTagsChange,
}) => (
  <>
    <EmailSyncToggle
      checked={emailState.emailSync}
      disabled={isDisabled}
      onChange={onEmailSyncChange}
    />
    <EmailFolderInput
      disabled={isDisabled || !emailState.emailSync}
      onChange={onEmailFolderChange}
      value={emailState.emailFolder}
    />
    <EmailIntervalSelect
      disabled={isDisabled || !emailState.emailSync}
      onChange={onEmailIntervalChange}
      value={emailState.emailSyncInterval}
    />
    <EmailTagsInput
      disabled={isDisabled || !emailState.emailSync}
      onChange={onEmailTagsChange}
      value={emailState.emailSyncTags}
    />
  </>
);

export const EmailSection: FC<EmailSectionProps> = (props) => {
  const { isLoading, isConnected, lastSync } = props;
  const isDisabled = !isConnected || isLoading;

  return (
    <div className="rounded-lg border p-4">
      <div className="space-y-4">
        <EmailHeader />
        <EmailConnectionStatus
          connectedEmail={props.connectedEmail}
          isConnected={isConnected}
          isLoading={isLoading}
          onConnect={props.onConnectGmail}
          onDisconnect={props.onDisconnect}
        />
        <EmailSettings
          emailState={props.emailState}
          isDisabled={isDisabled}
          onEmailFolderChange={props.onEmailFolderChange}
          onEmailIntervalChange={props.onEmailIntervalChange}
          onEmailSyncChange={props.onEmailSyncChange}
          onEmailTagsChange={props.onEmailTagsChange}
        />
        {lastSync && (
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            <strong>Last sync:</strong> {formatDate(lastSync)}
          </div>
        )}
        <EmailActions
          isConnected={isConnected}
          isLoading={isLoading}
          isResyncing={props.isResyncing}
          onForceResync={props.onForceResync}
          onSaveEmail={props.onSaveEmail}
          syncEnabled={props.emailState.emailSync}
        />
      </div>
    </div>
  );
};
