/**
 * GitHub integration section for UserProfile
 */
import { Button, Label, TextInput } from 'flowbite-react';
import { type FC } from 'react';

import { ToggleSwitch } from './toggle_switch';
import { formatDate, type GithubFormState } from './user_profile_types';

interface GithubTokenInputProps {
  isLoading: boolean;
  value: string;
  onChange: (token: string) => void;
}

const GithubTokenInput: FC<GithubTokenInputProps> = ({ isLoading, value, onChange }) => (
  <div>
    <Label htmlFor="githubToken">GitHub Personal Access Token</Label>
    <TextInput
      disabled={isLoading}
      id="githubToken"
      onChange={(e) => onChange(e.target.value)}
      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      type="password"
      value={value}
    />
    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      Required for syncing private repositories. Token needs <code>repo</code> scope.{' '}
      <a
        className="text-primary-600 hover:underline"
        href="https://github.com/settings/tokens/new"
        rel="noopener noreferrer"
        target="_blank"
      >
        Create token
      </a>
    </p>
  </div>
);

interface GithubIntervalSelectProps {
  disabled: boolean;
  value: number;
  onChange: (interval: number) => void;
}

const INTERVAL_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
];

const GithubIntervalSelect: FC<GithubIntervalSelectProps> = ({ disabled, value, onChange }) => (
  <div>
    <Label htmlFor="githubSyncInterval">Sync Interval</Label>
    <select
      className="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
      disabled={disabled}
      id="githubSyncInterval"
      onChange={(e) => onChange(Number(e.target.value))}
      value={value}
    >
      {INTERVAL_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      How often to check for new/updated GitHub issues. Each repository becomes its own context
      (e.g., &quot;walterra/eddoapp&quot;).
    </p>
  </div>
);

interface GithubTagsInputProps {
  disabled: boolean;
  value: string;
  onChange: (tags: string) => void;
}

const GithubTagsInput: FC<GithubTagsInputProps> = ({ disabled, value, onChange }) => (
  <div>
    <Label htmlFor="githubSyncTags">Tags</Label>
    <TextInput
      disabled={disabled}
      id="githubSyncTags"
      onChange={(e) => onChange(e.target.value)}
      placeholder="github, gtd:next"
      type="text"
      value={value}
    />
    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      Comma-separated tags to add to synced todos
    </p>
  </div>
);

export interface GithubSectionProps {
  isLoading: boolean;
  isResyncing: boolean;
  lastSync?: string;
  githubState: GithubFormState;
  onGithubSyncChange: (enabled: boolean) => void;
  onGithubTokenChange: (token: string) => void;
  onGithubIntervalChange: (interval: number) => void;
  onGithubTagsChange: (tags: string) => void;
  onSaveGithub: () => Promise<void>;
  onForceResync: () => Promise<void>;
}

const GithubHeader: FC = () => (
  <div>
    <h3 className="font-medium text-neutral-900 dark:text-white">GitHub Issue Sync</h3>
    <p className="text-sm text-neutral-600">
      Automatically sync your GitHub issues as todos. Issues are synced periodically and assigned to
      a context.
    </p>
  </div>
);

interface GithubSyncToggleProps {
  checked: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}

const GithubSyncToggle: FC<GithubSyncToggleProps> = ({ checked, disabled, onChange }) => (
  <div className="flex items-center justify-between">
    <div>
      <Label>Enable GitHub Sync</Label>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">Sync GitHub issues to todos</p>
    </div>
    <ToggleSwitch checked={checked} disabled={disabled} onChange={onChange} />
  </div>
);

interface GithubActionsProps {
  isLoading: boolean;
  isResyncing: boolean;
  syncEnabled: boolean;
  onForceResync: () => Promise<void>;
  onSaveGithub: () => Promise<void>;
}

const GithubActions: FC<GithubActionsProps> = ({
  isLoading,
  isResyncing,
  syncEnabled,
  onForceResync,
  onSaveGithub,
}) => (
  <div className="flex justify-between gap-4 border-t pt-4">
    <Button color="gray" disabled={isResyncing || !syncEnabled} onClick={onForceResync}>
      {isResyncing ? 'Resyncing...' : 'Force Resync'}
    </Button>
    <Button color="blue" disabled={isLoading} onClick={onSaveGithub}>
      {isLoading ? 'Saving...' : 'Save GitHub Settings'}
    </Button>
  </div>
);

export const GithubSection: FC<GithubSectionProps> = ({
  isLoading,
  isResyncing,
  lastSync,
  githubState,
  onGithubSyncChange,
  onGithubTokenChange,
  onGithubIntervalChange,
  onGithubTagsChange,
  onSaveGithub,
  onForceResync,
}) => (
  <div className="rounded-lg border p-4">
    <div className="space-y-4">
      <GithubHeader />
      <GithubSyncToggle
        checked={githubState.githubSync}
        disabled={isLoading}
        onChange={onGithubSyncChange}
      />
      <GithubTokenInput
        isLoading={isLoading}
        onChange={onGithubTokenChange}
        value={githubState.githubToken}
      />
      <GithubIntervalSelect
        disabled={!githubState.githubSync || isLoading}
        onChange={onGithubIntervalChange}
        value={githubState.githubSyncInterval}
      />
      <GithubTagsInput
        disabled={!githubState.githubSync || isLoading}
        onChange={onGithubTagsChange}
        value={githubState.githubSyncTags}
      />
      {lastSync && (
        <div className="text-sm text-neutral-600">
          <strong>Last sync:</strong> {formatDate(lastSync)}
        </div>
      )}
      <GithubActions
        isLoading={isLoading}
        isResyncing={isResyncing}
        onForceResync={onForceResync}
        onSaveGithub={onSaveGithub}
        syncEnabled={githubState.githubSync}
      />
    </div>
  </div>
);
