/**
 * Type definitions for user profile hook
 */

export type ThemePreference = 'system' | 'light' | 'dark';

export interface UserPreferences {
  dailyBriefing: boolean;
  briefingTime?: string;
  printBriefing?: boolean;
  dailyRecap: boolean;
  recapTime?: string;
  printRecap?: boolean;
  timezone?: string;
  theme?: ThemePreference;
  viewMode?: 'kanban' | 'table';
  tableColumns?: string[];
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
  viewMode?: 'kanban' | 'table';
  tableColumns?: string[];
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
