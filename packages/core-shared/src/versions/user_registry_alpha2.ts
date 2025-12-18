import isNil from 'lodash-es/isNil';

import { UserRegistryEntryAlpha1 } from './user_registry_alpha1';

type UnknownObject = Record<string, unknown> | { [key: string]: unknown };

export interface UserPreferences {
  dailyBriefing: boolean;
  briefingTime?: string; // HH:MM format, defaults to 07:00
  printBriefing?: boolean; // Enable/disable thermal printer output
  dailyRecap: boolean;
  recapTime?: string; // HH:MM format, defaults to 18:00
  printRecap?: boolean; // Enable/disable thermal printer output for recap
  timezone?: string; // Future timezone support
  viewMode?: 'kanban' | 'table'; // Todo view preference, defaults to kanban
  tableColumns?: string[]; // Selected columns for table view
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
    viewMode: 'kanban',
    tableColumns: ['title', 'due', 'tags', 'timeTracked', 'status'],
  };
}
