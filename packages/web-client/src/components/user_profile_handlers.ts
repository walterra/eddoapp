/**
 * User profile event handlers
 * Extracted from user_profile.tsx to reduce function size
 */
import type { GithubFormState, PreferencesFormState, ProfileFormState } from './user_profile_types';

// Validation helpers

/**
 * Validate profile form fields
 */
export function validateProfileForm(
  formState: ProfileFormState,
  _currentEmail?: string,
): string | null {
  if (!formState.email) {
    return 'Email is required';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
    return 'Please enter a valid email address';
  }

  if (formState.newPassword) {
    if (!formState.currentPassword) {
      return 'Current password is required to change password';
    }
    if (formState.newPassword.length < 8) {
      return 'New password must be at least 8 characters long';
    }
    if (formState.newPassword !== formState.confirmPassword) {
      return 'New passwords do not match';
    }
  }

  return null;
}

/**
 * Validate password change form
 */
export function validatePasswordChange(formState: ProfileFormState): string | null {
  if (!formState.currentPassword || !formState.newPassword) {
    return 'Both current and new passwords are required';
  }

  if (formState.newPassword.length < 8) {
    return 'New password must be at least 8 characters long';
  }

  if (formState.newPassword !== formState.confirmPassword) {
    return 'New passwords do not match';
  }

  return null;
}

/**
 * Validate Telegram ID
 */
export function validateTelegramId(telegramId: string): string | null {
  const telegramIdNumber = parseInt(telegramId, 10);
  if (!telegramId || isNaN(telegramIdNumber) || telegramIdNumber <= 0) {
    return 'Please enter a valid Telegram ID (positive number)';
  }
  return null;
}

/**
 * Validate GitHub token format
 */
export function validateGithubToken(token: string): string | null {
  if (token && !token.match(/^(ghp_|github_pat_)/)) {
    return 'Invalid GitHub token format. Token should start with ghp_ or github_pat_';
  }
  return null;
}

/**
 * Build profile update data from form state
 */
export function buildProfileUpdateData(
  formState: ProfileFormState,
  currentEmail?: string,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  if (formState.email !== currentEmail) {
    updateData.email = formState.email;
  }

  if (formState.newPassword) {
    updateData.currentPassword = formState.currentPassword;
    updateData.newPassword = formState.newPassword;
  }

  return updateData;
}

/**
 * Build GitHub preferences update data
 */
export function buildGithubUpdateData(githubState: GithubFormState) {
  return {
    githubSync: githubState.githubSync,
    githubToken: githubState.githubToken || null,
    githubSyncInterval: githubState.githubSyncInterval,
    githubSyncTags: githubState.githubSyncTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

/** Default preferences state values */
const DEFAULT_PREFERENCES: PreferencesFormState = {
  dailyBriefing: false,
  briefingTime: '07:00',
  printBriefing: false,
  dailyRecap: false,
  recapTime: '18:00',
  printRecap: false,
};

/**
 * Initialize preferences state from profile
 */
export function initializePreferencesState(
  preferences?: {
    dailyBriefing?: boolean;
    briefingTime?: string;
    printBriefing?: boolean;
    dailyRecap?: boolean;
    recapTime?: string;
    printRecap?: boolean;
  } | null,
): PreferencesFormState {
  if (!preferences) return { ...DEFAULT_PREFERENCES };
  return {
    dailyBriefing: preferences.dailyBriefing ?? DEFAULT_PREFERENCES.dailyBriefing,
    briefingTime: preferences.briefingTime ?? DEFAULT_PREFERENCES.briefingTime,
    printBriefing: preferences.printBriefing ?? DEFAULT_PREFERENCES.printBriefing,
    dailyRecap: preferences.dailyRecap ?? DEFAULT_PREFERENCES.dailyRecap,
    recapTime: preferences.recapTime ?? DEFAULT_PREFERENCES.recapTime,
    printRecap: preferences.printRecap ?? DEFAULT_PREFERENCES.printRecap,
  };
}

/**
 * Initialize GitHub state from profile
 */
export function initializeGithubState(
  preferences?: {
    githubSync?: boolean;
    githubToken?: string | null;
    githubSyncInterval?: number;
    githubSyncTags?: string[];
  } | null,
): GithubFormState {
  return {
    githubSync: preferences?.githubSync ?? false,
    githubToken: preferences?.githubToken ?? '',
    githubSyncInterval: preferences?.githubSyncInterval ?? 60,
    githubSyncTags: preferences?.githubSyncTags?.join(', ') ?? 'github, gtd:next',
  };
}
