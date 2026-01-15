/**
 * Type definitions for user profile hook
 */
import { type ThemePreference, type ViewMode } from '@eddo/core-shared';

export type { ThemePreference };

export interface RssFeedConfigUI {
  url: string;
  feedUrl: string;
  title?: string;
  enabled: boolean;
  addedAt: string;
}

/** Date handling mode for filter presets */
export type FilterPresetDateMode = 'relative' | 'fixed';

/** Time range type for filter presets */
export type FilterPresetTimeRangeType =
  | 'current-day'
  | 'current-week'
  | 'current-month'
  | 'current-year'
  | 'all-time'
  | 'custom';

/** Time range configuration for filter presets */
export interface FilterPresetTimeRange {
  type: FilterPresetTimeRangeType;
  startDate?: string;
  endDate?: string;
}

/** Completion status for filter presets */
export type FilterPresetStatus = 'all' | 'completed' | 'incomplete';

/** Saved filter preset configuration */
export interface FilterPreset {
  id: string;
  name: string;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: FilterPresetStatus;
  selectedTimeRange: FilterPresetTimeRange;
  dateMode: FilterPresetDateMode;
  savedDate?: string;
  createdAt: string;
}

export interface UserPreferences {
  dailyBriefing: boolean;
  briefingTime?: string;
  printBriefing?: boolean;
  dailyRecap: boolean;
  recapTime?: string;
  printRecap?: boolean;
  timezone?: string;
  theme?: ThemePreference;
  viewMode?: ViewMode;
  tableColumns?: string[];
  activitySidebarOpen?: boolean;
  chatSidebarOpen?: boolean;
  chatSidebarSessionId?: string;
  selectedTags?: string[];
  selectedContexts?: string[];
  selectedStatus?: 'all' | 'completed' | 'incomplete';
  selectedTimeRange?: {
    type: 'current-day' | 'current-week' | 'current-month' | 'current-year' | 'all-time' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  currentDate?: string;
  githubSync?: boolean;
  githubToken?: string | null;
  githubSyncInterval?: number;
  githubSyncTags?: string[];
  githubLastSync?: string;
  githubSyncStartedAt?: string;
  rssSync?: boolean;
  rssFeeds?: RssFeedConfigUI[];
  rssSyncInterval?: number;
  rssSyncTags?: string[];
  rssLastSync?: string;
  emailSync?: boolean;
  emailConfig?: {
    provider: 'gmail' | 'imap';
    oauthEmail?: string;
    imapUser?: string;
  };
  emailFolder?: string;
  emailSyncInterval?: number;
  emailSyncTags?: string[];
  emailLastSync?: string;
  filterPresets?: FilterPreset[];
}

export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  telegramId?: number;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
  status: string;
  preferences: UserPreferences;
}

export interface UpdateProfileData {
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePreferencesData {
  dailyBriefing?: boolean;
  briefingTime?: string;
  printBriefing?: boolean;
  dailyRecap?: boolean;
  recapTime?: string;
  printRecap?: boolean;
  timezone?: string;
  theme?: ThemePreference;
  viewMode?: ViewMode;
  tableColumns?: string[];
  activitySidebarOpen?: boolean;
  chatSidebarOpen?: boolean;
  chatSidebarSessionId?: string;
  selectedTags?: string[];
  selectedContexts?: string[];
  selectedStatus?: 'all' | 'completed' | 'incomplete';
  selectedTimeRange?: {
    type: 'current-day' | 'current-week' | 'current-month' | 'current-year' | 'all-time' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  currentDate?: string;
  githubSync?: boolean;
  githubToken?: string | null;
  githubSyncInterval?: number;
  githubSyncTags?: string[];
  rssSync?: boolean;
  rssFeeds?: RssFeedConfigUI[];
  rssSyncInterval?: number;
  rssSyncTags?: string[];
  emailSync?: boolean;
  emailConfig?: {
    provider: 'gmail' | 'imap';
    oauthEmail?: string;
    imapUser?: string;
  } | null;
  emailFolder?: string;
  emailSyncInterval?: number;
  emailSyncTags?: string[];
  filterPresets?: FilterPreset[];
}

export interface GithubResyncResponse {
  message: string;
  synced: number;
  created: number;
  updated: number;
}

export interface GithubResyncError {
  error: string;
  rateLimitError?: boolean;
  resetTime?: string;
}

export interface ProfileResult {
  success: boolean;
  error?: string;
}
