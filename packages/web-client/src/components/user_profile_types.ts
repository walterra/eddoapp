/**
 * Shared types for UserProfile components
 */

export interface ProfileFormState {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  telegramId: string;
}

export interface PreferencesFormState {
  dailyBriefing: boolean;
  briefingTime: string;
  printBriefing: boolean;
  dailyRecap: boolean;
  recapTime: string;
  printRecap: boolean;
}

export interface GithubFormState {
  githubSync: boolean;
  githubToken: string;
  githubSyncInterval: number;
  githubSyncTags: string;
}

export interface RssFormState {
  rssSync: boolean;
  rssSyncInterval: number;
  rssSyncTags: string;
}

export interface EmailFormState {
  emailSync: boolean;
  emailFolder: string;
  emailSyncInterval: number;
  emailSyncTags: string;
}

export interface EmailSyncConfigUI {
  provider: 'gmail' | 'imap';
  oauthEmail?: string;
  imapUser?: string;
}

/** Re-export UserProfile type from hook */
export type { UserProfile } from '../hooks/use_profile_types';

export interface RssFeedConfigUI {
  url: string;
  feedUrl: string;
  title?: string;
  enabled: boolean;
  addedAt: string;
}

export interface ProfileData {
  username: string;
  email: string;
  status: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  telegramId?: number;
  preferences?: {
    dailyBriefing: boolean;
    briefingTime?: string;
    printBriefing?: boolean;
    dailyRecap?: boolean;
    recapTime?: string;
    printRecap?: boolean;
    githubSync?: boolean;
    githubToken?: string | null;
    githubSyncInterval?: number;
    githubSyncTags?: string[];
    githubLastSync?: string;
    rssSync?: boolean;
    rssFeeds?: RssFeedConfigUI[];
    rssSyncInterval?: number;
    rssSyncTags?: string[];
    rssLastSync?: string;
    emailSync?: boolean;
    emailConfig?: EmailSyncConfigUI;
    emailFolder?: string;
    emailSyncInterval?: number;
    emailSyncTags?: string[];
    emailLastSync?: string;
  };
}

export interface ProfileTabProps {
  profile: ProfileData;
  isLoading: boolean;
  formState: ProfileFormState;
  editMode: boolean;
  onEditToggle: () => void;
  onEmailChange: (email: string) => void;
  onCurrentPasswordChange: (password: string) => void;
  onNewPasswordChange: (password: string) => void;
  onConfirmPasswordChange: (password: string) => void;
  onSave: () => Promise<void>;
}

export interface SecurityTabProps {
  isLoading: boolean;
  formState: Pick<ProfileFormState, 'currentPassword' | 'newPassword' | 'confirmPassword'>;
  onCurrentPasswordChange: (password: string) => void;
  onNewPasswordChange: (password: string) => void;
  onConfirmPasswordChange: (password: string) => void;
  onChangePassword: () => Promise<void>;
}

export interface IntegrationsTabProps {
  profile: ProfileData;
  isLoading: boolean;
  isResyncing: boolean;
  telegramId: string;
  githubState: GithubFormState;
  rssState: RssFormState;
  emailState: EmailFormState;
  onTelegramIdChange: (id: string) => void;
  onLinkTelegram: () => Promise<void>;
  onUnlinkTelegram: () => Promise<void>;
  onGithubSyncChange: (enabled: boolean) => void;
  onGithubTokenChange: (token: string) => void;
  onGithubIntervalChange: (interval: number) => void;
  onGithubTagsChange: (tags: string) => void;
  onSaveGithub: () => Promise<void>;
  onForceResync: () => Promise<void>;
  onRssSyncChange: (enabled: boolean) => void;
  onRssIntervalChange: (interval: number) => void;
  onRssTagsChange: (tags: string) => void;
  onAddRssFeed: (url: string) => Promise<void>;
  onRemoveRssFeed: (index: number) => Promise<void>;
  onForceRssResync: () => Promise<void>;
  onSaveRss: () => Promise<void>;
  isRssResyncing: boolean;
  // Email sync props
  onEmailSyncChange: (enabled: boolean) => void;
  onEmailFolderChange: (folder: string) => void;
  onEmailIntervalChange: (interval: number) => void;
  onEmailTagsChange: (tags: string) => void;
  onSaveEmail: () => Promise<void>;
  onForceEmailResync: () => Promise<void>;
  onConnectGmail: () => Promise<void>;
  onDisconnectEmail: () => Promise<void>;
  isEmailResyncing: boolean;
}

export interface PreferencesTabProps {
  isLoading: boolean;
  preferencesState: PreferencesFormState;
  onDailyBriefingChange: (enabled: boolean) => void;
  onBriefingTimeChange: (time: string) => void;
  onPrintBriefingChange: (enabled: boolean) => void;
  onDailyRecapChange: (enabled: boolean) => void;
  onRecapTimeChange: (time: string) => void;
  onPrintRecapChange: (enabled: boolean) => void;
  onSave: () => Promise<void>;
}

/**
 * Formats a date string for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Shared sync interval options for integrations
 */
export const SYNC_INTERVAL_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
];
