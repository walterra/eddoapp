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
  onTelegramIdChange: (id: string) => void;
  onLinkTelegram: () => Promise<void>;
  onUnlinkTelegram: () => Promise<void>;
  onGithubSyncChange: (enabled: boolean) => void;
  onGithubTokenChange: (token: string) => void;
  onGithubIntervalChange: (interval: number) => void;
  onGithubTagsChange: (tags: string) => void;
  onSaveGithub: () => Promise<void>;
  onForceResync: () => Promise<void>;
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
