import isNil from 'lodash-es/isNil';

import { UserRegistryEntryAlpha1 } from './user_registry_alpha1';

type UnknownObject = Record<string, unknown> | { [key: string]: unknown };

export type ThemePreference = 'system' | 'light' | 'dark';

/** RSS feed configuration */
export interface RssFeedConfig {
  /** Original URL provided by user */
  url: string;
  /** Discovered/resolved feed URL */
  feedUrl: string;
  /** Feed title (from autodiscovery or feed itself) */
  title?: string;
  /** Whether this feed is enabled for sync */
  enabled: boolean;
  /** ISO timestamp when feed was added */
  addedAt: string;
}

/** Email authentication provider type */
export type EmailProvider = 'gmail' | 'imap';

/** Email sync configuration */
export interface EmailSyncConfig {
  /** Authentication provider (gmail for OAuth, imap for credentials) */
  provider: EmailProvider;
  /** Gmail OAuth refresh token (for provider: 'gmail') */
  oauthRefreshToken?: string;
  /** Gmail email address (set during OAuth) */
  oauthEmail?: string;
  /** IMAP host (for provider: 'imap') */
  imapHost?: string;
  /** IMAP port (for provider: 'imap', default: 993) */
  imapPort?: number;
  /** IMAP username (for provider: 'imap') */
  imapUser?: string;
  /** IMAP password (for provider: 'imap') */
  imapPassword?: string;
}

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
  // RSS Sync
  rssSync?: boolean; // Enable/disable RSS feed sync
  rssFeeds?: RssFeedConfig[]; // Array of subscribed feeds
  rssSyncInterval?: number; // Minutes between syncs, defaults to 60
  rssSyncTags?: string[]; // Tags to add to synced items, defaults to ["gtd:someday", "source:rss"]
  rssLastSync?: string; // ISO timestamp of last successful sync
  // Email Sync
  emailSync?: boolean; // Enable/disable email sync
  emailConfig?: EmailSyncConfig; // Email authentication configuration
  emailFolder?: string; // IMAP folder to sync from, defaults to "Eddo"
  emailSyncInterval?: number; // Minutes between syncs, defaults to 15
  emailSyncTags?: string[]; // Tags to add to synced emails, defaults to ["source:email", "gtd:next"]
  emailLastSync?: string; // ISO timestamp of last successful sync
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
    rssSync: false,
    rssFeeds: [],
    rssSyncInterval: 60,
    rssSyncTags: ['gtd:someday', 'source:rss'],
    rssLastSync: undefined,
    emailSync: false,
    emailConfig: undefined,
    emailFolder: 'Eddo',
    emailSyncInterval: 15,
    emailSyncTags: ['source:email', 'gtd:next'],
    emailLastSync: undefined,
  };
}
