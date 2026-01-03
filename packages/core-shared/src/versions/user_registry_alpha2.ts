import isNil from 'lodash-es/isNil';

import { UserRegistryEntryAlpha1 } from './user_registry_alpha1';

type UnknownObject = Record<string, unknown> | { [key: string]: unknown };

export type ThemePreference = 'system' | 'light' | 'dark';

export interface UserPreferences {
  dailyBriefing: boolean;
  briefingTime?: string; // HH:MM format, defaults to 07:00
  printBriefing?: boolean; // Enable/disable thermal printer output
  dailyRecap: boolean;
  recapTime?: string; // HH:MM format, defaults to 18:00
  printRecap?: boolean; // Enable/disable thermal printer output for recap
  timezone?: string; // Future timezone support
  theme?: ThemePreference; // UI theme preference, defaults to system
  viewMode?: 'kanban' | 'table'; // Todo view preference, defaults to kanban
  tableColumns?: string[]; // Selected columns for table view
  selectedTags?: string[]; // Filter: selected tags
  selectedContexts?: string[]; // Filter: selected contexts
  selectedStatus?: 'all' | 'completed' | 'incomplete'; // Filter: completion status
  selectedTimeRange?: {
    type: 'current-day' | 'current-week' | 'current-month' | 'current-year' | 'all-time' | 'custom';
    startDate?: string;
    endDate?: string;
  }; // Filter: time range
  currentDate?: string; // Filter: current date for navigation (ISO string)
  githubSync?: boolean; // Enable/disable GitHub issue sync
  githubToken?: string | null; // GitHub Personal Access Token (encrypted in production)
  githubSyncInterval?: number; // Minutes between syncs, defaults to 60
  githubSyncTags?: string[]; // Tags to add to synced issues, defaults to ["github", "gtd:next"]
  githubLastSync?: string; // ISO timestamp of last successful sync
  githubSyncStartedAt?: string; // ISO timestamp when sync was first enabled (max lookback)
}

export interface UserRegistryEntryAlpha2 extends Omit<UserRegistryEntryAlpha1, 'version'> {
  preferences: UserPreferences;
  version: 'alpha2';
}

export function isUserRegistryEntryAlpha2(arg: unknown): arg is UserRegistryEntryAlpha2 {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'version' in arg &&
    (arg as UnknownObject).version === 'alpha2'
  );
}

export function createDefaultUserPreferences(): UserPreferences {
  return {
    dailyBriefing: false,
    briefingTime: '07:00',
    printBriefing: false,
    dailyRecap: false,
    recapTime: '18:00',
    printRecap: false,
    timezone: undefined,
    theme: 'system',
    viewMode: 'kanban',
    tableColumns: ['title', 'due', 'tags', 'timeTracked', 'status'],
    selectedTags: [],
    selectedContexts: [],
    selectedStatus: 'all',
    selectedTimeRange: { type: 'current-week' },
    currentDate: undefined,
    githubSync: false,
    githubToken: null,
    githubSyncInterval: 60,
    githubSyncTags: ['github', 'gtd:next'],
    githubLastSync: undefined,
    githubSyncStartedAt: undefined,
  };
}
