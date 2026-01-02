/**
 * Integrations tab component for UserProfile
 */
import { Button, Card, Label, TextInput } from 'flowbite-react';

import { ToggleSwitch } from './toggle_switch';
import { formatDate, type IntegrationsTabProps } from './user_profile_types';

export function IntegrationsTab({
  profile,
  isLoading,
  isResyncing,
  telegramId,
  githubState,
  onTelegramIdChange,
  onLinkTelegram,
  onUnlinkTelegram,
  onGithubSyncChange,
  onGithubTokenChange,
  onGithubIntervalChange,
  onGithubTagsChange,
  onSaveGithub,
  onForceResync,
}: IntegrationsTabProps) {
  return (
    <Card>
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">External Integrations</h2>

        <div className="space-y-4">
          <TelegramSection
            isLoading={isLoading}
            onLinkTelegram={onLinkTelegram}
            onTelegramIdChange={onTelegramIdChange}
            onUnlinkTelegram={onUnlinkTelegram}
            profile={profile}
            telegramId={telegramId}
          />

          <GithubSection
            githubState={githubState}
            isLoading={isLoading}
            isResyncing={isResyncing}
            lastSync={profile.preferences?.githubLastSync}
            onForceResync={onForceResync}
            onGithubIntervalChange={onGithubIntervalChange}
            onGithubSyncChange={onGithubSyncChange}
            onGithubTagsChange={onGithubTagsChange}
            onGithubTokenChange={onGithubTokenChange}
            onSaveGithub={onSaveGithub}
          />
        </div>
      </div>
    </Card>
  );
}

interface TelegramSectionProps {
  profile: IntegrationsTabProps['profile'];
  isLoading: boolean;
  telegramId: string;
  onTelegramIdChange: (id: string) => void;
  onLinkTelegram: () => Promise<void>;
  onUnlinkTelegram: () => Promise<void>;
}

function TelegramSection({
  profile,
  isLoading,
  telegramId,
  onTelegramIdChange,
  onLinkTelegram,
  onUnlinkTelegram,
}: TelegramSectionProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Telegram Bot</h3>
          <p className="text-sm text-gray-600">
            {profile.telegramId
              ? `Connected to Telegram ID: ${profile.telegramId}`
              : 'Not connected to Telegram'}
          </p>
        </div>

        {profile.telegramId ? (
          <Button color="red" disabled={isLoading} onClick={onUnlinkTelegram}>
            {isLoading ? 'Unlinking...' : 'Unlink'}
          </Button>
        ) : null}
      </div>

      {!profile.telegramId && (
        <TelegramLinkForm
          isLoading={isLoading}
          onLinkTelegram={onLinkTelegram}
          onTelegramIdChange={onTelegramIdChange}
          telegramId={telegramId}
        />
      )}
    </div>
  );
}

interface TelegramLinkFormProps {
  isLoading: boolean;
  telegramId: string;
  onTelegramIdChange: (id: string) => void;
  onLinkTelegram: () => Promise<void>;
}

function TelegramLinkForm({
  isLoading,
  telegramId,
  onTelegramIdChange,
  onLinkTelegram,
}: TelegramLinkFormProps) {
  return (
    <div className="mt-4 space-y-4 border-t pt-4">
      <div>
        <h4 className="font-medium text-gray-900">Link Telegram Account</h4>
        <p className="text-sm text-gray-600">
          Enter your Telegram ID to link your account. You can get your Telegram ID by messaging the
          bot.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label htmlFor="telegramId">Telegram ID</Label>
          <TextInput
            disabled={isLoading}
            id="telegramId"
            onChange={(e) => onTelegramIdChange(e.target.value)}
            placeholder="Enter your Telegram ID (e.g., 123456789)"
            type="text"
            value={telegramId}
          />
        </div>
        <Button color="blue" disabled={isLoading || !telegramId} onClick={onLinkTelegram}>
          {isLoading ? 'Linking...' : 'Link Account'}
        </Button>
      </div>

      <div className="text-sm text-gray-500">
        <p>
          💡 <strong>How to get your Telegram ID:</strong>
        </p>
        <ol className="mt-1 list-inside list-decimal space-y-1">
          <li>Message the Telegram bot</li>
          <li>The bot will reply with your Telegram ID</li>
          <li>Copy and paste it into the field above</li>
          <li>Click &quot;Link Account&quot;</li>
        </ol>
      </div>
    </div>
  );
}

interface GithubSectionProps {
  isLoading: boolean;
  isResyncing: boolean;
  lastSync?: string;
  githubState: IntegrationsTabProps['githubState'];
  onGithubSyncChange: (enabled: boolean) => void;
  onGithubTokenChange: (token: string) => void;
  onGithubIntervalChange: (interval: number) => void;
  onGithubTagsChange: (tags: string) => void;
  onSaveGithub: () => Promise<void>;
  onForceResync: () => Promise<void>;
}

function GithubSection({
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
}: GithubSectionProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-gray-900">GitHub Issue Sync</h3>
          <p className="text-sm text-gray-600">
            Automatically sync your GitHub issues as todos. Issues are synced periodically and
            assigned to a context.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Enable GitHub Sync</Label>
            <p className="text-xs text-gray-500">Sync GitHub issues to todos</p>
          </div>
          <ToggleSwitch
            checked={githubState.githubSync}
            disabled={isLoading}
            onChange={onGithubSyncChange}
          />
        </div>

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
          <div className="text-sm text-gray-600">
            <strong>Last sync:</strong> {formatDate(lastSync)}
          </div>
        )}

        <div className="flex justify-between gap-4 border-t pt-4">
          <Button
            color="gray"
            disabled={isResyncing || !githubState.githubSync}
            onClick={onForceResync}
          >
            {isResyncing ? 'Resyncing...' : 'Force Resync'}
          </Button>
          <Button color="blue" disabled={isLoading} onClick={onSaveGithub}>
            {isLoading ? 'Saving...' : 'Save GitHub Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface GithubTokenInputProps {
  isLoading: boolean;
  value: string;
  onChange: (token: string) => void;
}

function GithubTokenInput({ isLoading, value, onChange }: GithubTokenInputProps) {
  return (
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
      <p className="mt-1 text-xs text-gray-500">
        Required for syncing private repositories. Token needs <code>repo</code> scope.{' '}
        <a
          className="text-blue-600 hover:underline"
          href="https://github.com/settings/tokens/new"
          rel="noopener noreferrer"
          target="_blank"
        >
          Create token
        </a>
      </p>
    </div>
  );
}

interface GithubIntervalSelectProps {
  disabled: boolean;
  value: number;
  onChange: (interval: number) => void;
}

function GithubIntervalSelect({ disabled, value, onChange }: GithubIntervalSelectProps) {
  return (
    <div>
      <Label htmlFor="githubSyncInterval">Sync Interval</Label>
      <select
        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
        disabled={disabled}
        id="githubSyncInterval"
        onChange={(e) => onChange(Number(e.target.value))}
        value={value}
      >
        <option value={1}>1 minute</option>
        <option value={5}>5 minutes</option>
        <option value={15}>15 minutes</option>
        <option value={30}>30 minutes</option>
        <option value={60}>1 hour</option>
        <option value={120}>2 hours</option>
        <option value={240}>4 hours</option>
      </select>
      <p className="mt-1 text-xs text-gray-500">
        How often to check for new/updated GitHub issues. Each repository becomes its own context
        (e.g., &quot;walterra/eddoapp&quot;).
      </p>
    </div>
  );
}

interface GithubTagsInputProps {
  disabled: boolean;
  value: string;
  onChange: (tags: string) => void;
}

function GithubTagsInput({ disabled, value, onChange }: GithubTagsInputProps) {
  return (
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
      <p className="mt-1 text-xs text-gray-500">Comma-separated tags to add to synced todos</p>
    </div>
  );
}
