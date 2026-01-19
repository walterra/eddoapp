/**
 * Integrations tab component for UserProfile
 */
import { Button, Card, Label, TextInput } from 'flowbite-react';
import { type FC } from 'react';

import { AiKeysSection } from './user_profile_ai_keys_section';
import { EmailSection } from './user_profile_email_section';
import { GithubSection } from './user_profile_github_section';
import { RssSection } from './user_profile_rss_section';
import type { IntegrationsTabProps } from './user_profile_types';

const IntegrationsHeader: FC = () => (
  <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">External Integrations</h2>
);

function isEmailConnected(profile: IntegrationsTabProps['profile']): boolean {
  const config = profile.preferences?.emailConfig;
  return config != null && (config.oauthEmail != null || config.imapUser != null);
}

function getConnectedEmail(profile: IntegrationsTabProps['profile']): string | undefined {
  const config = profile.preferences?.emailConfig;
  return config?.oauthEmail || config?.imapUser;
}

const EmailSectionWrapper: FC<IntegrationsTabProps> = (props) => (
  <EmailSection
    connectedEmail={getConnectedEmail(props.profile)}
    emailState={props.emailState}
    isConnected={isEmailConnected(props.profile)}
    isLoading={props.isLoading}
    isResyncing={props.isEmailResyncing}
    lastSync={props.profile.preferences?.emailLastSync}
    onConnectGmail={props.onConnectGmail}
    onDisconnect={props.onDisconnectEmail}
    onEmailFolderChange={props.onEmailFolderChange}
    onEmailIntervalChange={props.onEmailIntervalChange}
    onEmailSyncChange={props.onEmailSyncChange}
    onEmailTagsChange={props.onEmailTagsChange}
    onForceResync={props.onForceEmailResync}
    onSaveEmail={props.onSaveEmail}
  />
);

const GithubSectionWrapper: FC<IntegrationsTabProps> = (props) => (
  <GithubSection
    githubState={props.githubState}
    isLoading={props.isLoading}
    isResyncing={props.isResyncing}
    lastSync={props.profile.preferences?.githubLastSync}
    onForceResync={props.onForceResync}
    onGithubIntervalChange={props.onGithubIntervalChange}
    onGithubSyncChange={props.onGithubSyncChange}
    onGithubTagsChange={props.onGithubTagsChange}
    onGithubTokenChange={props.onGithubTokenChange}
    onSaveGithub={props.onSaveGithub}
  />
);

const RssSectionWrapper: FC<IntegrationsTabProps> = (props) => (
  <RssSection
    feeds={props.profile.preferences?.rssFeeds || []}
    isLoading={props.isLoading}
    isResyncing={props.isRssResyncing}
    lastSync={props.profile.preferences?.rssLastSync}
    onAddFeed={props.onAddRssFeed}
    onForceResync={props.onForceRssResync}
    onRemoveFeed={props.onRemoveRssFeed}
    onRssIntervalChange={props.onRssIntervalChange}
    onRssSyncChange={props.onRssSyncChange}
    onRssTagsChange={props.onRssTagsChange}
    onSaveRss={props.onSaveRss}
    rssState={props.rssState}
  />
);

const AiKeysSectionWrapper: FC<IntegrationsTabProps> = (props) => (
  <AiKeysSection
    aiKeys={props.profile.preferences?.aiProviderKeys}
    isLoading={props.isLoading}
    onSaveAiKeys={props.onSaveAiKeys}
  />
);

export function IntegrationsTab(props: IntegrationsTabProps) {
  return (
    <Card>
      <div className="space-y-6">
        <IntegrationsHeader />
        <div className="space-y-4">
          <TelegramSection
            isLoading={props.isLoading}
            onLinkTelegram={props.onLinkTelegram}
            onTelegramIdChange={props.onTelegramIdChange}
            onUnlinkTelegram={props.onUnlinkTelegram}
            profile={props.profile}
            telegramId={props.telegramId}
          />
          <GithubSectionWrapper {...props} />
          <RssSectionWrapper {...props} />
          <EmailSectionWrapper {...props} />
          <AiKeysSectionWrapper {...props} />
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

const TelegramHeader: FC<{
  telegramId?: number;
  isLoading: boolean;
  onUnlink: () => Promise<void>;
}> = ({ telegramId, isLoading, onUnlink }) => (
  <div className="flex items-center justify-between">
    <div>
      <h3 className="font-medium text-neutral-900 dark:text-white">Telegram Bot</h3>
      <p className="text-sm text-neutral-600">
        {telegramId ? `Connected to Telegram ID: ${telegramId}` : 'Not connected to Telegram'}
      </p>
    </div>
    {telegramId ? (
      <Button color="red" disabled={isLoading} onClick={onUnlink}>
        {isLoading ? 'Unlinking...' : 'Unlink'}
      </Button>
    ) : null}
  </div>
);

const TelegramInstructions: FC = () => (
  <div className="text-sm text-neutral-500">
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
);

interface TelegramLinkFormProps {
  isLoading: boolean;
  telegramId: string;
  onTelegramIdChange: (id: string) => void;
  onLinkTelegram: () => Promise<void>;
}

const TelegramLinkForm: FC<TelegramLinkFormProps> = ({
  isLoading,
  telegramId,
  onTelegramIdChange,
  onLinkTelegram,
}) => (
  <div className="mt-4 space-y-4 border-t pt-4">
    <div>
      <h4 className="font-medium text-neutral-900 dark:text-white">Link Telegram Account</h4>
      <p className="text-sm text-neutral-600">
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
    <TelegramInstructions />
  </div>
);

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
      <TelegramHeader
        isLoading={isLoading}
        onUnlink={onUnlinkTelegram}
        telegramId={profile.telegramId}
      />
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
